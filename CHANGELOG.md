# Changelog

## [1.0.0] - 2026-02-04

### Added
- Initial implementation of Realtor.ca scraper
- Full Phase 2 architecture (Redis + PostgreSQL + Prometheus)
- City-based discovery (15 major Canadian cities)
- Geographic grid discovery (entire Canada)
- Distributed worker processing with queue management
- Change detection with checksum comparison
- Missing property verification
- Adaptive scheduling based on change rates
- Prometheus metrics and observability
- Docker deployment support
- Complete documentation

### Features
- Two-phase scraping: Coordinator discovers IDs, Workers process details
- Redis queue for distributed processing
- PostgreSQL Scraper DB (Tier 1) for historical tracking
- Checksum-based change detection
- Missing property detection and verification
- Prometheus metrics for monitoring
- Grafana dashboard support
- Docker Compose deployment
- Multiple workers support

### Coverage
- 15 major Canadian cities
- Full Canada geographic grid coverage
- Both sale and rental properties
- All property types (houses, apartments, townhouses, etc.)

### API Support
- Realtor.ca PropertySearch_Post endpoint
- Realtor.ca PropertyDetails endpoint
- Session management with cookies
- Rate limiting and retry logic

### Documentation
- Complete README with setup instructions
- Phase 2 Architecture documentation
- Data extraction mapping
- Docker deployment guide
