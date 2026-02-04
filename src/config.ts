import dotenv from 'dotenv';
import { CityCoordinates } from './types';

dotenv.config();

export const config = {
  // Landomo Core Service
  apiUrl: process.env.LANDOMO_API_URL || 'https://core.landomo.com/api/v1',
  apiKey: process.env.LANDOMO_API_KEY || '',

  // Scraper Identity
  portal: 'realtor',
  country: 'canada',

  // Realtor.ca API
  baseApiUrl: 'https://api2.realtor.ca',
  searchEndpoint: '/Listing.svc/PropertySearch_Post',
  detailsEndpoint: '/Listing.svc/PropertyDetails',
  siteUrl: 'https://www.realtor.ca',

  // Scraper Behavior
  debug: process.env.DEBUG === 'true',
  requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS || '3000'),
  maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '3'),
  pageSize: parseInt(process.env.PAGE_SIZE || '12'),
  transactionType: parseInt(process.env.TRANSACTION_TYPE || '2'), // 2 = Sale, 3 = Rent

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },

  // Optional: Scraper Database (Tier 1)
  scraperDb: {
    host: process.env.SCRAPER_DB_HOST,
    port: parseInt(process.env.SCRAPER_DB_PORT || '5432'),
    database: process.env.SCRAPER_DB_NAME,
    user: process.env.SCRAPER_DB_USER,
    password: process.env.SCRAPER_DB_PASSWORD,
  },

  // Optional: Proxy
  proxy: {
    url: process.env.PROXY_URL,
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
  },
};

// Major Canadian city coordinates
export const CITY_COORDS: Record<string, CityCoordinates> = {
  'toronto-on-canada': {
    lat: 43.6532,
    lng: -79.3832,
    viewport: { north: 43.85, south: 43.55, east: -79.20, west: -79.60 },
  },
  'vancouver-bc-canada': {
    lat: 49.2827,
    lng: -123.1207,
    viewport: { north: 49.35, south: 49.20, east: -123.00, west: -123.25 },
  },
  'montreal-qc-canada': {
    lat: 45.5017,
    lng: -73.5673,
    viewport: { north: 45.70, south: 45.40, east: -73.45, west: -73.75 },
  },
  'calgary-ab-canada': {
    lat: 51.0447,
    lng: -114.0719,
    viewport: { north: 51.20, south: 50.90, east: -113.90, west: -114.25 },
  },
  'edmonton-ab-canada': {
    lat: 53.5461,
    lng: -113.4938,
    viewport: { north: 53.70, south: 53.40, east: -113.30, west: -113.70 },
  },
  'ottawa-on-canada': {
    lat: 45.4215,
    lng: -75.6972,
    viewport: { north: 45.53, south: 45.32, east: -75.55, west: -75.85 },
  },
  'winnipeg-mb-canada': {
    lat: 49.8951,
    lng: -97.1384,
    viewport: { north: 49.98, south: 49.80, east: -97.00, west: -97.30 },
  },
  'quebec-qc-canada': {
    lat: 46.8139,
    lng: -71.2080,
    viewport: { north: 46.90, south: 46.73, east: -71.15, west: -71.30 },
  },
  'hamilton-on-canada': {
    lat: 43.2557,
    lng: -79.8711,
    viewport: { north: 43.35, south: 43.18, east: -79.75, west: -80.00 },
  },
  'kitchener-on-canada': {
    lat: 43.4516,
    lng: -80.4925,
    viewport: { north: 43.53, south: 43.38, east: -80.40, west: -80.60 },
  },
  'london-on-canada': {
    lat: 42.9849,
    lng: -81.2453,
    viewport: { north: 43.08, south: 42.90, east: -81.15, west: -81.35 },
  },
  'victoria-bc-canada': {
    lat: 48.4284,
    lng: -123.3656,
    viewport: { north: 48.50, south: 48.35, east: -123.30, west: -123.45 },
  },
  'halifax-ns-canada': {
    lat: 44.6488,
    lng: -63.5752,
    viewport: { north: 44.75, south: 44.55, east: -63.45, west: -63.70 },
  },
  'saskatoon-sk-canada': {
    lat: 52.1332,
    lng: -106.6700,
    viewport: { north: 52.25, south: 52.02, east: -106.55, west: -106.80 },
  },
  'regina-sk-canada': {
    lat: 50.4452,
    lng: -104.6189,
    viewport: { north: 50.55, south: 50.35, east: -104.50, west: -104.75 },
  },
};

// Canada geographic boundaries
export const CANADA_BOUNDS = {
  north: 60.0,   // Southern territories
  south: 41.67,  // Southern Ontario/Pelee Island
  east: -52.62,  // Newfoundland
  west: -141.0,  // Yukon/Alaska border
};
