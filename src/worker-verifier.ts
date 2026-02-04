/**
 * Realtor.ca Missing Property Verifier - Verify and Disable Missing Properties
 *
 * Consumes property IDs from missing_queue and verifies if they're truly inactive.
 *
 * Features:
 * - Verifies properties not seen in last 12 hours
 * - Marks verified inactive properties in Core Service
 * - Handles properties that come back online
 *
 * Usage:
 *   npm run worker:verifier
 */

import axios from 'axios';
import { config } from './config';
import { markPropertyInactive } from './core';
import { logger } from './logger';
import { randomDelay } from './utils';
import { RedisQueue } from './redis-queue';

export class MissingPropertyVerifier {
  private queue: RedisQueue;
  private workerId: string;
  private isRunning: boolean = false;
  private verifiedInactiveCount: number = 0;
  private foundActiveCount: number = 0;

  constructor(workerId?: string) {
    this.workerId = workerId || `verifier-${process.pid}`;
    this.queue = new RedisQueue('realtor');
  }

  async initialize() {
    await this.queue.initialize();
    logger.info(`Verifier ${this.workerId} initialized`);
  }

  /**
   * Verify if property still exists
   */
  async verifyProperty(id: string): Promise<boolean> {
    // For Realtor.ca, we use the PropertyDetails endpoint
    const formData = `PropertyID=${id}&ApplicationId=1&CultureId=1&HashCode=0`;

    try {
      const response = await axios.post(`${config.baseApiUrl}${config.detailsEndpoint}`, formData, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        timeout: 30000,
      });

      // If we get a response with data, property still exists
      if (response.data && response.data.Id) {
        return true;
      }

      return false;
    } catch (error) {
      // If 404 or property not found, consider it inactive
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return false;
      }

      // For other errors, throw to retry
      throw error;
    }
  }

  /**
   * Process single missing property
   */
  async processMissingProperty(id: string): Promise<boolean> {
    try {
      logger.info(`[${this.workerId}] Verifying property ${id}...`);

      const exists = await this.verifyProperty(id);

      if (exists) {
        // Property is back! Update last_seen
        logger.info(`[${this.workerId}] Property ${id} is ACTIVE (returned)`);
        await this.queue.updateLastSeen(id);
        this.foundActiveCount++;
        return true;
      } else {
        // Property confirmed inactive
        logger.info(`[${this.workerId}] Property ${id} is INACTIVE (not found)`);

        // Mark as inactive in Core Service
        if (config.apiKey) {
          await markPropertyInactive(
            config.portal,
            id,
            config.country,
            'not_found'
          );
        }

        // Mark as verified inactive in Redis
        await this.queue.markVerifiedInactive(id);
        this.verifiedInactiveCount++;
        return true;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[${this.workerId}] Failed to verify ${id}:`, errorMsg);
      return false;
    }
  }

  /**
   * Start verifier (blocking loop)
   */
  async start(): Promise<void> {
    this.isRunning = true;
    logger.info(`[${this.workerId}] Starting missing property verifier...`);

    let emptyQueueCount = 0;
    const maxEmptyChecks = 10;

    while (this.isRunning) {
      try {
        // Pop next ID from missing queue
        const id = await this.queue.popFromMissingQueue(5);

        if (!id) {
          emptyQueueCount++;

          if (emptyQueueCount >= maxEmptyChecks) {
            logger.info(`[${this.workerId}] Missing queue empty after ${maxEmptyChecks} checks. Stopping.`);
            break;
          }

          // Show stats while waiting
          const missingDepth = await this.queue.getMissingQueueDepth();
          const inactiveCount = await this.queue.getVerifiedInactiveCount();
          logger.info(
            `[${this.workerId}] Missing queue empty (${emptyQueueCount}/${maxEmptyChecks}). ` +
            `Missing: ${missingDepth}, Verified Inactive: ${inactiveCount}`
          );
          continue;
        }

        // Reset empty count
        emptyQueueCount = 0;

        // Verify the property
        await this.processMissingProperty(id);

        // Rate limiting
        await randomDelay(2000, 4000);

        // Log progress every 10 properties
        const total = this.verifiedInactiveCount + this.foundActiveCount;
        if (total % 10 === 0 && total > 0) {
          logger.info(
            `[${this.workerId}] Progress: ${this.verifiedInactiveCount} inactive, ` +
            `${this.foundActiveCount} active`
          );
        }
      } catch (error) {
        logger.error(`[${this.workerId}] Verifier error:`, error);
        await randomDelay(5000, 10000);
      }
    }

    logger.info(
      `[${this.workerId}] Verifier stopped. ` +
      `Verified Inactive: ${this.verifiedInactiveCount}, Found Active: ${this.foundActiveCount}`
    );
  }

  /**
   * Stop verifier gracefully
   */
  async stop(): Promise<void> {
    logger.info(`[${this.workerId}] Stopping verifier...`);
    this.isRunning = false;
    await this.queue.close();
  }

  /**
   * Get verifier stats
   */
  getStats() {
    return {
      workerId: this.workerId,
      verifiedInactiveCount: this.verifiedInactiveCount,
      foundActiveCount: this.foundActiveCount,
      isRunning: this.isRunning,
    };
  }
}

// Main execution
async function main() {
  const workerId = process.env.WORKER_ID || `verifier-${process.pid}`;

  logger.info('Starting Realtor.ca Missing Property Verifier');
  logger.info(`Verifier ID: ${workerId}`);

  const verifier = new MissingPropertyVerifier(workerId);
  await verifier.initialize();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully...');
    await verifier.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    await verifier.stop();
    process.exit(0);
  });

  try {
    // Start verifying
    await verifier.start();

    // Show final stats
    const stats = verifier.getStats();
    logger.info('=== VERIFIER STATS ===', stats);

    // Show queue stats
    const queue = new RedisQueue('realtor');
    await queue.initialize();
    const inactiveCount = await queue.getVerifiedInactiveCount();
    logger.info(`=== VERIFIED INACTIVE: ${inactiveCount} ===`);
    await queue.close();
  } catch (error) {
    logger.error('Verifier failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
