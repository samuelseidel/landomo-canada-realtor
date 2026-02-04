/**
 * Realtor.ca Coordinator - Phase 1: ID Discovery
 *
 * Discovers all listing IDs and pushes them to Redis queue for workers to process.
 *
 * Supports two strategies:
 * - City-based: 15 major Canadian cities
 * - Geo grid: Geographic grid covering all of Canada
 *
 * Usage:
 *   npm run coordinator          # City-based discovery
 *   npm run coordinator:geo      # Geo grid discovery
 */

import { config, CITY_COORDS, CANADA_BOUNDS } from './config';
import { logger } from './logger';
import { randomDelay } from './utils';
import { RealtorClient } from './realtor-client';
import { RedisQueue } from './redis-queue';

// Major Canadian cities
const MAJOR_CITIES = [
  'toronto-on',
  'vancouver-bc',
  'montreal-qc',
  'calgary-ab',
  'edmonton-ab',
  'ottawa-on',
  'winnipeg-mb',
  'quebec-qc',
  'hamilton-on',
  'kitchener-on',
  'london-on',
  'victoria-bc',
  'halifax-ns',
  'saskatoon-sk',
  'regina-sk',
];

export class RealtorCoordinator {
  private client: RealtorClient;
  private queue: RedisQueue;

  constructor() {
    this.client = new RealtorClient();
    this.queue = new RedisQueue('realtor');
  }

  async initialize() {
    await this.client.initializeSession();
    await this.queue.initialize();
    logger.info('Coordinator initialized');
  }

  /**
   * Get city info (coordinates and viewport)
   */
  private getCityInfo(slug: string) {
    const fullSlug = `${slug}-canada`;
    if (CITY_COORDS[fullSlug]) {
      return CITY_COORDS[fullSlug];
    }
    // Default to Toronto if not found
    return CITY_COORDS['toronto-on-canada'];
  }

  /**
   * Discover IDs for a single city and push to queue
   */
  async discoverCity(citySlug: string): Promise<number> {
    const cityInfo = this.getCityInfo(citySlug);
    const parts = citySlug.split('-');
    const province = parts[parts.length - 1].toUpperCase();
    const cityName = parts.slice(0, -1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

    logger.info(`Discovering IDs for ${cityName}, ${province}`);

    let totalAdded = 0;
    let page = 1;

    try {
      // Fetch first page to get total
      const firstPage = await this.client.searchProperties({
        latMax: cityInfo.viewport.north,
        latMin: cityInfo.viewport.south,
        lonMax: cityInfo.viewport.east,
        lonMin: cityInfo.viewport.west,
        page: 1,
      });

      if (firstPage.total === 0) {
        logger.info(`${cityName}: No listings found`);
        return 0;
      }

      // Extract IDs and push to queue
      const ids = this.client.extractListingIds(firstPage.listings);
      const added = await this.queue.pushListingIds(ids);
      totalAdded += added;

      logger.info(`${cityName}: Found ${firstPage.total} listings (Page 1/${firstPage.totalPages}), queued ${added} new IDs`);

      // Fetch remaining pages
      for (page = 2; page <= firstPage.totalPages; page++) {
        await randomDelay(config.requestDelayMs * 0.8, config.requestDelayMs * 1.2);

        const pageResult = await this.client.searchProperties({
          latMax: cityInfo.viewport.north,
          latMin: cityInfo.viewport.south,
          lonMax: cityInfo.viewport.east,
          lonMin: cityInfo.viewport.west,
          page,
        });

        const pageIds = this.client.extractListingIds(pageResult.listings);
        const pageAdded = await this.queue.pushListingIds(pageIds);
        totalAdded += pageAdded;

        logger.info(`${cityName}: Page ${page}/${firstPage.totalPages}, queued ${pageAdded} new IDs`);
      }

      logger.info(`${cityName}: Completed. Queued ${totalAdded} new IDs (${firstPage.total - totalAdded} duplicates)`);
      return totalAdded;

    } catch (error) {
      logger.error(`Failed to discover ${cityName}:`, error);
      return 0;
    }
  }

  /**
   * Discover IDs for all major cities
   */
  async discoverAllCities(): Promise<void> {
    logger.info('=== CITY-BASED DISCOVERY: 15 Major Cities ===');

    let totalAdded = 0;
    let citiesProcessed = 0;

    for (const citySlug of MAJOR_CITIES) {
      const added = await this.discoverCity(citySlug);
      totalAdded += added;
      citiesProcessed++;

      if (citiesProcessed % 5 === 0) {
        const stats = await this.queue.getStats();
        logger.info(`Progress: ${citiesProcessed}/${MAJOR_CITIES.length} cities | ${stats.totalDiscovered} total IDs`);
      }

      await randomDelay(config.requestDelayMs, config.requestDelayMs * 1.5);
    }

    const finalStats = await this.queue.getStats();
    logger.info('=== DISCOVERY COMPLETE ===', {
      citiesProcessed,
      totalDiscovered: finalStats.totalDiscovered,
      newIdsQueued: totalAdded,
    });

    // Find and queue missing properties
    await this.identifyMissingProperties();
  }

  /**
   * Identify properties not seen recently and queue for verification
   */
  async identifyMissingProperties(hoursThreshold: number = 24): Promise<void> {
    logger.info(`\n=== IDENTIFYING MISSING PROPERTIES (>${hoursThreshold}h) ===`);

    const missingIds = await this.queue.findMissingProperties(hoursThreshold);

    if (missingIds.length === 0) {
      logger.info('No missing properties found');
      return;
    }

    logger.info(`Found ${missingIds.length} properties not seen in last ${hoursThreshold} hours`);

    const queued = await this.queue.pushToMissingQueue(missingIds);
    logger.info(`Queued ${queued} properties for verification`);
  }

  /**
   * Generate geographic grid cells
   */
  generateGrid(gridSize: number = 1.0): Array<{ lat: number; lng: number; viewport: any; index: number; total: number }> {
    const cells = [];
    let index = 0;

    const latSteps = Math.ceil((CANADA_BOUNDS.north - CANADA_BOUNDS.south) / gridSize);
    const lngSteps = Math.ceil((CANADA_BOUNDS.east - CANADA_BOUNDS.west) / gridSize);
    const totalCells = latSteps * lngSteps;

    for (let lat = CANADA_BOUNDS.south; lat < CANADA_BOUNDS.north; lat += gridSize) {
      for (let lng = CANADA_BOUNDS.west; lng < CANADA_BOUNDS.east; lng += gridSize) {
        cells.push({
          lat: lat + (gridSize / 2),
          lng: lng + (gridSize / 2),
          viewport: {
            north: lat + gridSize,
            south: lat,
            east: lng + gridSize,
            west: lng,
          },
          index: ++index,
          total: totalCells,
        });
      }
    }

    return cells;
  }

  /**
   * Discover IDs using geographic grid (entire Canada)
   */
  async discoverGeoGrid(gridSize: number = 1.0): Promise<void> {
    logger.info(`=== GEO GRID DISCOVERY: Grid size ${gridSize}° ===`);

    const grid = this.generateGrid(gridSize);
    logger.info(`Generated ${grid.length} grid cells`);

    let totalAdded = 0;
    let cellsWithListings = 0;

    for (const cell of grid) {
      try {
        const result = await this.client.searchProperties({
          latMax: cell.viewport.north,
          latMin: cell.viewport.south,
          lonMax: cell.viewport.east,
          lonMin: cell.viewport.west,
          page: 1,
        });

        if (result.total === 0) {
          continue; // Empty cell
        }

        cellsWithListings++;

        // Get all pages for this cell
        const ids = this.client.extractListingIds(result.listings);
        let cellAdded = await this.queue.pushListingIds(ids);
        totalAdded += cellAdded;

        // Fetch remaining pages if needed
        for (let page = 2; page <= result.totalPages; page++) {
          await randomDelay(config.requestDelayMs * 0.5, config.requestDelayMs);

          const pageResult = await this.client.searchProperties({
            latMax: cell.viewport.north,
            latMin: cell.viewport.south,
            lonMax: cell.viewport.east,
            lonMin: cell.viewport.west,
            page,
          });

          const pageIds = this.client.extractListingIds(pageResult.listings);
          const pageAdded = await this.queue.pushListingIds(pageIds);
          cellAdded += pageAdded;
          totalAdded += pageAdded;
        }

        logger.info(`Cell ${cell.index}/${cell.total}: ${result.total} listings, ${cellAdded} new IDs`);

        // Progress update every 50 cells
        if (cell.index % 50 === 0) {
          const stats = await this.queue.getStats();
          logger.info(`Progress: ${cell.index}/${grid.length} cells | ${stats.totalDiscovered} IDs | ${cellsWithListings} cells with listings`);
        }

      } catch (error) {
        logger.error(`Failed cell ${cell.index}:`, error);
      }

      await randomDelay(config.requestDelayMs * 0.5, config.requestDelayMs);
    }

    const finalStats = await this.queue.getStats();
    logger.info('=== DISCOVERY COMPLETE ===', {
      totalCells: grid.length,
      cellsWithListings,
      totalDiscovered: finalStats.totalDiscovered,
      newIdsQueued: totalAdded,
    });
  }

  async cleanup() {
    await this.queue.close();
  }
}

// Main execution
async function main() {
  const mode = process.argv[2] || 'city';

  logger.info('Starting Realtor.ca Coordinator');
  logger.info(`Mode: ${mode === 'geo' ? 'Geographic Grid' : 'City-Based'}`);

  const coordinator = new RealtorCoordinator();
  await coordinator.initialize();

  try {
    if (mode === 'geo') {
      const gridSize = parseFloat(process.env.GRID_SIZE || '1.0');
      await coordinator.discoverGeoGrid(gridSize);
    } else {
      await coordinator.discoverAllCities();
    }

    const stats = await coordinator['queue'].getStats();
    logger.info('=== FINAL STATS ===', stats);

    await coordinator.cleanup();
  } catch (error) {
    logger.error('Coordinator failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
