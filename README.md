# Realtor.ca Scraper - Canada

Production-ready scraper for Realtor.ca, Canada's national real estate portal.

**Status**: ✅ Production Ready | **Phase 2**: Complete

---

## Quick Start

```bash
# Install dependencies
npm install

# Run city-based scraper (15 major cities - fast)
npm run coordinator

# Run geo grid scraper (entire Canada - comprehensive)
npm run coordinator:geo

# Start workers (Phase 2: Process discovered IDs)
npm run worker
```

---

## Features

- ✅ **Phase 2 Architecture**: Redis queue + PostgreSQL + Prometheus metrics
- ✅ **Dual Scraping Approaches**: City-based (fast) + Geo grid (comprehensive)
- ✅ **Change Detection**: Checksum-based with snapshot comparison
- ✅ **Missing Property Detection**: Identifies removed listings
- ✅ **Distributed Processing**: Multiple workers for parallel processing
- ✅ **Adaptive Scheduling**: Dynamic intervals based on change rates
- ✅ **Full Observability**: Prometheus metrics + Grafana dashboards

---

## Scraping Approaches

### Approach 1: City-Based - Fast & Targeted

```bash
npm run coordinator
```

- **Coverage**: 15 major Canadian cities
- **Cities**: Toronto, Vancouver, Montreal, Calgary, Edmonton, Ottawa, Winnipeg, Quebec City, Hamilton, Kitchener, London, Victoria, Halifax, Saskatoon, Regina
- **Speed**: ⚡ 1-2 hours
- **Use case**: Daily updates, major markets

### Approach 2: Geo Grid - Complete & Comprehensive

```bash
npm run coordinator:geo
```

- **Coverage**: Entire Canada (geographic grid)
- **Speed**: 🐢 6-12 hours
- **Properties**: 100% of inventory
- **Use case**: Initial scrape, comprehensive coverage

---

## Phase 2 Architecture

### Components

1. **Coordinator** - Discovers listing IDs, pushes to Redis queue
2. **Workers** - Process IDs from queue, fetch details, send to Core Service
3. **Verifier Worker** - Verifies missing properties, marks as inactive
4. **Metrics Server** - Exposes Prometheus metrics
5. **PostgreSQL** - Stores snapshots, changes, metadata
6. **Redis** - Queue management, deduplication, last-seen tracking

### Data Flow

```
Coordinator (Phase 1)
  → Discover listing IDs
  → Push to Redis queue
  → Update last_seen timestamps

Workers (Phase 2)
  → Pop ID from queue
  → Fetch property details
  → Compare with snapshot (Redis)
  → If changed: Send to Core Service
  → Store snapshot (PostgreSQL)
  → Mark as processed

Verifier Worker (Phase 3)
  → Pop from missing_queue
  → Verify if property still exists
  → If not: Mark as inactive in Core Service
```

---

## Configuration

### Environment Variables

```bash
# Core Service API
LANDOMO_API_URL=https://core.landomo.com/api/v1
LANDOMO_API_KEY=your_api_key_here

# Scraper Settings
DEBUG=false
REQUEST_DELAY_MS=3000
TRANSACTION_TYPE=2  # 2 = Sale, 3 = Rent

# Redis
REDIS_URL=redis://localhost:6379

# PostgreSQL (Tier 1 Scraper DB)
SCRAPER_DB_HOST=localhost
SCRAPER_DB_PORT=5432
SCRAPER_DB_NAME=scraper_canada_realtor
SCRAPER_DB_USER=landomo
SCRAPER_DB_PASSWORD=your_password
```

Copy `.env.example` to `.env` and configure.

---

## Commands

### Production

```bash
npm run coordinator          # City-based discovery (15 cities)
npm run coordinator:geo      # Geo grid discovery (all of Canada)
npm run worker               # Start worker (process queue)
npm run worker:verifier      # Start verifier (check missing properties)
npm run metrics              # Start Prometheus metrics server
```

### Queue Management

```bash
npm run queue:stats          # Show queue statistics
npm run queue:clear          # Clear all queue data
npm run queue:retry-failed   # Retry failed listings
npm run queue:show-failed    # Show failed listing IDs
```

### Development

```bash
npm run build                # Compile TypeScript
npm run lint                 # Run linter
npm run type-check           # TypeScript type checking
```

---

## Data Extraction

### What Data is Extracted?

✅ **Core Property Data**
- Title, price (CAD), property type, transaction type, URL

✅ **Location**
- Full address, city, province, postal code, GPS coordinates

✅ **Property Details**
- Bedrooms, bathrooms, square feet (sqft), square meters (sqm)

✅ **Images**
- All property photos from listings

✅ **Canada-Specific Fields**
- MLS number, building type, lot size, province

✅ **Complete Raw Data**
- Original API response preserved

---

## Geographic Coverage

### City-Based (15 Major Cities)

- **Ontario**: Toronto, Ottawa, Hamilton, Kitchener, London
- **British Columbia**: Vancouver, Victoria
- **Quebec**: Montreal, Quebec City
- **Alberta**: Calgary, Edmonton
- **Manitoba**: Winnipeg
- **Nova Scotia**: Halifax
- **Saskatchewan**: Saskatoon, Regina

### Geo Grid - Entire Canada

- **North**: 60.0°N (Southern territories)
- **South**: 41.67°N (Southern Ontario)
- **East**: -52.62°W (Newfoundland)
- **West**: -141.0°W (Yukon/Alaska border)
- **Grid cells**: 1° × 1° (adjustable)

---

## API Endpoints Used

### Primary Endpoints

1. **PropertySearch_Post** (Listing Search)
   - URL: `https://api2.realtor.ca/Listing.svc/PropertySearch_Post`
   - Purpose: Search properties by geographic bounds
   - Returns: Property listings with details

2. **PropertyDetails** (Detail Fetch)
   - URL: `https://api2.realtor.ca/Listing.svc/PropertyDetails`
   - Purpose: Fetch complete property details
   - Returns: Full property data

### Rate Limiting

- Random delays: 0.6x-1.6x base delay (3000ms default)
- Session management: Cookies maintained
- Exponential backoff: 3 retries with 2x backoff

---

## PostgreSQL Database (Tier 1)

### Tables

- `property_snapshots` - Full raw data at each scrape
- `property_changes` - Detailed change tracking
- `property_metadata` - Aggregated stats per property
- `scrape_runs` - Track each scraping session
- `worker_stats` - Worker performance tracking
- `geographic_areas` - Area-based scheduling

### Setup

```bash
# Create database
createdb scraper_canada_realtor

# Run schema
psql -U landomo -d scraper_canada_realtor -f database/schema.sql
```

---

## Prometheus Metrics

### Exposed Metrics

- `scraper_properties_processed_total` - Total processed
- `scraper_properties_discovered_total` - Total discovered
- `scraper_change_rate` - Current change rate
- `scraper_queue_depth` - Queue depth
- `scraper_api_call_duration_seconds` - API response times
- `scraper_errors_total` - Total errors

### Accessing Metrics

```bash
# Start metrics server
npm run metrics

# Access metrics
curl http://localhost:9090/metrics

# Health check
curl http://localhost:9090/health
```

---

## Docker Deployment

### Docker Compose

```bash
# Start all services
docker-compose up -d

# Scale workers
docker-compose up -d --scale worker=5

# View logs
docker-compose logs -f worker

# Stop services
docker-compose down
```

### Services

- `postgres` - PostgreSQL database
- `redis` - Redis queue
- `coordinator` - ID discovery (scheduled)
- `worker` - Property processing (scaled)
- `metrics` - Prometheus metrics
- `prometheus` - Metrics collection
- `grafana` - Dashboards

---

## Integration with Core Service

### Sending Data

```typescript
import { sendToCoreService } from './core';

await sendToCoreService({
  portal: 'realtor',
  portal_id: mlsNumber,
  country: 'canada',
  data: transformToStandard(property),  // StandardProperty format
  raw_data: property                    // Original API response
});
```

### StandardProperty Format

All data is transformed to unified `StandardProperty` format before sending to Core Service.

**Required fields**:
- `title`, `currency`, `property_type`, `transaction_type`, `location.country`

**Country-specific fields**:
- `mls_number`, `building_type`, `lot_size`, `province`

---

## Performance

### City-Based

- **Runtime**: 1-2 hours
- **Properties**: ~100,000-200,000
- **Cities processed**: 15 (parallel)
- **Success rate**: ~95%

### Geo Grid

- **Runtime**: 6-12 hours
- **Properties**: ~300,000-500,000
- **Grid cells**: ~3,300 (1° × 1°)
- **Success rate**: ~95%
- **Empty cells**: ~70% (auto-skipped)

---

## Documentation

Complete documentation in [`docs/`](docs/) folder:

- **[Phase 2 Architecture](docs/PHASE-2-ARCHITECTURE.md)** - Full Phase 2 implementation
- **[Data Extraction Mapping](docs/DATA-EXTRACTION-MAPPING.md)** - Complete field mapping
- **[Scraping Approaches](docs/SCRAPING-APPROACHES.md)** - City-based vs Geo Grid

---

## Troubleshooting

### No properties found

- Check `TRANSACTION_TYPE` in `.env` (2 = Sale, 3 = Rent)
- Verify API endpoints are accessible
- Check session initialization (cookies)

### Rate limiting / blocked

- Increase `REQUEST_DELAY_MS` in `.env`
- Session management is automatic
- Consider using proxies

### Missing Core Service integration

- Set `LANDOMO_API_KEY` in `.env`
- Data will log to console if API key not set

---

## Technical Stack

- **Language**: TypeScript
- **HTTP Client**: axios (session management)
- **Queue**: Redis (ioredis)
- **Database**: PostgreSQL (pg)
- **Metrics**: Prometheus (prom-client)
- **Logging**: Winston

---

## License

UNLICENSED - Proprietary

---

## Support

- Documentation: [`docs/`](docs/)
- Global Architecture: `/landomo/CLAUDE.md`
- Issues: Create issue in landomo-registry repository

---

**Maintained by**: Landomo
**Last Updated**: 2026-02-04
**Status**: Production Ready ✅
**Phase 2**: Complete ✅
