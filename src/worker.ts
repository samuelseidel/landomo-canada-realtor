/**
 * Realtor.ca Worker - Phase 2: Detail Fetching
 *
 * Consumes listing IDs from Redis queue and fetches property details.
 *
 * Features:
 * - Distributed processing (run multiple workers)
 * - Automatic retry with exponential backoff
 * - Rate limiting per worker
 * - Progress tracking
 * - Change detection
 *
 * Usage:
 *   npm run worker              # Start single worker
 */

import { config } from './config';
import { transformToStandard } from './transformer';
import { sendToCoreService } from './core';
import { logger } from './logger';
import { randomDelay } from './utils';
import { RedisQueue } from './redis-queue';
import { RealtorClient } from './realtor-client';

export class RealtorWorker {
  private queue: RedisQueue;
  private client: RealtorClient;
  private workerId: string;
  private isRunning: boolean = false;
  private processedCount: number = 0;
  private failedCount: number = 0;
  private changedCount: number = 0;
  private unchangedCount: number = 0;

  constructor(workerId?: string) {
    this.workerId = workerId || `worker-${process.pid}`;
    this.queue = new RedisQueue('realtor');
    this.client = new RealtorClient();
  }

  async initialize() {
    await this.queue.initialize();
    await this.client.initializeSession();
    logger.info(`Worker ${this.workerId} initialized`);
  }

  /**
   * Fetch property details by MLS number
   */
  async fetchPropertyDetail(mlsNumber: string): Promise<any | null> {
    try {
      // For now, we'll use search to get property data
      // In production, you might want to implement getPropertyDetails
      // But search results contain most data we need

      // We already have the data from coordinator's search
      // So worker just needs to verify and transform
      return {
        id: mlsNumber,
        MlsNumber: mlsNumber,
        // This would be filled from actual API call
      };
    } catch (error) {
      throw new Error(`Fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process single listing ID
   */
  async processListing(id: string): Promise<boolean> {
    try {
      // Check if already processed
      const isProcessed = await this.queue.isProcessed(id);
      if (isProcessed) {
        logger.debug(`[${this.workerId}] Skipping ${id} - already processed`);
        return true;
      }

      // Fetch details
      const property = await this.fetchPropertyDetail(id);

      if (!property) {
        logger.warn(`[${this.workerId}] Property ${id} not found`);
        await this.queue.markFailed(id, 'Not found');
        return false;
      }

      // Check if property has changed
      const hasChanged = await this.queue.hasPropertyChanged(id, property);

      if (!hasChanged) {
        logger.debug(`[${this.workerId}] Property ${id} unchanged - skipping Core Service`);
        this.unchangedCount++;
      } else {
        logger.info(`[${this.workerId}] Property ${id} changed - sending to Core Service`);

        // Transform to StandardProperty
        const standardized = transformToStandard(property);

        // Send to Core Service
        if (config.apiKey) {
          await sendToCoreService({
            portal: config.portal,
            portal_id: id,
            country: config.country,
            data: standardized,
            raw_data: property,
            status: 'active'
          });
        }

        // Update snapshot
        await this.queue.storePropertySnapshot(id, property);
        this.changedCount++;
      }

      // Mark as processed
      await this.queue.markProcessed(id);
      this.processedCount++;

      if (this.processedCount % 10 === 0) {
        logger.info(
          `[${this.workerId}] Processed: ${this.processedCount} ` +
          `(Changed: ${this.changedCount}, Unchanged: ${this.unchangedCount}, Failed: ${this.failedCount})`
        );
      }

      return true;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[${this.workerId}] Failed to process ${id}:`, errorMsg);

      // Re-queue with retry limit
      const requeued = await this.queue.requeueWithRetry(id, 3);
      if (!requeued) {
        this.failedCount++;
        logger.error(`[${this.workerId}] Permanently failed ${id} after max retries`);
      }

      return false;
    }
  }

  /**
   * Start worker (blocking loop)
   */
  async start(): Promise<void> {
    this.isRunning = true;
    logger.info(`[${this.workerId}] Starting worker...`);

    let emptyQueueCount = 0;
    const maxEmptyChecks = 10;

    while (this.isRunning) {
      try {
        // Pop next ID from queue
        const id = await this.queue.popListingId(5);

        if (!id) {
          emptyQueueCount++;

          if (emptyQueueCount >= maxEmptyChecks) {
            logger.info(`[${this.workerId}] Queue empty after ${maxEmptyChecks} checks. Stopping.`);
            break;
          }

          const stats = await this.queue.getStats();
          logger.info(`[${this.workerId}] Queue empty (${emptyQueueCount}/${maxEmptyChecks}). Stats:`, stats);
          continue;
        }

        emptyQueueCount = 0;

        // Process the listing
        await this.processListing(id);

        // Rate limiting
        await randomDelay(
          config.requestDelayMs * 0.6,
          config.requestDelayMs * 1.6
        );

      } catch (error) {
        logger.error(`[${this.workerId}] Worker error:`, error);
        await randomDelay(5000, 10000);
      }
    }

    logger.info(
      `[${this.workerId}] Worker stopped. ` +
      `Processed: ${this.processedCount} (Changed: ${this.changedCount}, Unchanged: ${this.unchangedCount}, Failed: ${this.failedCount})`
    );
  }

  /**
   * Stop worker gracefully
   */
  async stop(): Promise<void> {
    logger.info(`[${this.workerId}] Stopping worker...`);
    this.isRunning = false;
    await this.queue.close();
  }

  /**
   * Get worker stats
   */
  getStats() {
    return {
      workerId: this.workerId,
      processedCount: this.processedCount,
      changedCount: this.changedCount,
      unchangedCount: this.unchangedCount,
      failedCount: this.failedCount,
      changeRate: this.processedCount > 0
        ? ((this.changedCount / this.processedCount) * 100).toFixed(2) + '%'
        : '0%',
      isRunning: this.isRunning,
    };
  }
}

// Main execution
async function main() {
  const workerId = process.env.WORKER_ID || `worker-${process.pid}`;

  logger.info('Starting Realtor.ca Worker');
  logger.info(`Worker ID: ${workerId}`);

  const worker = new RealtorWorker(workerId);
  await worker.initialize();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully...');
    await worker.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    await worker.stop();
    process.exit(0);
  });

  try {
    await worker.start();

    const stats = worker.getStats();
    logger.info('=== WORKER STATS ===', stats);

    const queueStats = await worker['queue'].getStats();
    logger.info('=== QUEUE STATS ===', queueStats);

  } catch (error) {
    logger.error('Worker failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
