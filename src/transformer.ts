import { StandardProperty } from './core';
import { config } from './config';
import { PropertyListing } from './types';

/**
 * Transform Realtor.ca data to StandardProperty format
 */
export function transformToStandard(listing: PropertyListing): StandardProperty {
  // Parse price
  const price = listing.Property?.Price || listing.Property?.PriceUnformattedValue;

  // Parse property type
  const propertyType = normalizePropertyType(
    listing.Building?.Type || listing.Property?.Type
  );

  // Parse bedrooms and bathrooms
  const bedrooms = listing.Building?.Bedrooms ? parseInt(listing.Building.Bedrooms) : undefined;
  const bathrooms = listing.Building?.BathroomTotal ? parseFloat(listing.Building.BathroomTotal) : undefined;

  // Parse square footage
  const sqft = listing.Building?.SizeInterior ? parseSqft(listing.Building.SizeInterior) : undefined;
  const sqm = sqft ? sqft * 0.092903 : undefined; // Convert sqft to sqm

  // Parse lot size
  const lotSize = listing.Land?.SizeTotal;

  // Get coordinates
  const lat = listing.Property?.Address?.Latitude;
  const lon = listing.Property?.Address?.Longitude;

  // Build address
  const address = listing.Property?.Address?.AddressText;
  const city = listing.Property?.Address?.CityDistrict;
  const province = listing.Property?.ProvinceName;
  const postalCode = listing.Property?.Address?.PostalCode;

  // Get images
  const images = (listing.Property?.Photo || [])
    .sort((a, b) => (a.SequenceId || 0) - (b.SequenceId || 0))
    .map(p => p.HighResPath || p.LowResPath)
    .filter(Boolean) as string[];

  // Build title
  const title = address
    ? `${propertyType} in ${city || province || 'Canada'} - ${address}`
    : `${propertyType} in ${city || province || 'Canada'}`;

  // Transaction type
  const transactionType = config.transactionType === 3 ? 'rent' : 'sale';

  // Build standard property object
  const standardProperty: StandardProperty = {
    // Basic Information
    title: title.trim(),
    price: price ? Number(price) : undefined,
    currency: 'CAD',
    property_type: propertyType,
    transaction_type: transactionType,

    // Location
    location: {
      address,
      city,
      state: province,
      country: config.country,
      postal_code: postalCode,
      coordinates: lat && lon ? { lat, lon } : undefined,
    },

    // Details
    details: {
      bedrooms,
      bathrooms,
      sqm,
      sqft,
      rooms: bedrooms, // Use bedrooms as estimate for total rooms
    },

    // Features & Amenities (not available in search results, would need detail fetch)
    features: [],
    amenities: {},

    // Country-Specific Fields for Canada
    country_specific: {
      mls_number: listing.MlsNumber,
      building_type: listing.Building?.Type,
      property_type_ca: listing.Property?.Type,
      lot_size: lotSize,
      province: province,
    },

    // Media
    images,
    description: listing.PublicRemarks,

    // Metadata
    url: listing.MlsNumber
      ? `${config.siteUrl}/real-estate/${listing.MlsNumber}`
      : undefined,
    status: 'active',
  };

  return standardProperty;
}

/**
 * Normalize Canadian property types to standard types
 */
function normalizePropertyType(caType: string | undefined): string {
  if (!caType) return 'other';

  const typeMap: Record<string, string> = {
    // Residential
    'single family': 'house',
    'house': 'house',
    'detached': 'house',
    'semi-detached': 'house',
    'apartment': 'apartment',
    'condo': 'apartment',
    'condominium': 'apartment',
    'townhouse': 'townhouse',
    'duplex': 'duplex',
    'triplex': 'multi_family',
    'fourplex': 'multi_family',
    'mobile home': 'mobile_home',
    'manufactured home': 'mobile_home',

    // Land
    'vacant land': 'land',
    'lot': 'land',
    'land': 'land',

    // Commercial
    'commercial': 'commercial',
    'office': 'commercial',
    'retail': 'commercial',
    'industrial': 'commercial',

    // Other
    'farm': 'land',
    'ranch': 'land',
  };

  const lowerType = caType.toLowerCase();
  for (const [key, value] of Object.entries(typeMap)) {
    if (lowerType.includes(key)) {
      return value;
    }
  }

  return 'other';
}

/**
 * Parse square footage from various formats
 */
function parseSqft(sizeStr: string): number | undefined {
  if (!sizeStr) return undefined;

  // Remove non-numeric characters except decimal point
  const cleaned = sizeStr.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? undefined : parsed;
}
