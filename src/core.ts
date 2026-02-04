import axios from 'axios';
import { config } from './config';
import { logger } from './logger';

export interface StandardProperty {
  title: string;
  price?: number;
  currency: string;
  property_type: string;
  transaction_type: string;
  location: {
    address?: string;
    city?: string;
    state?: string;
    country: string;
    postal_code?: string;
    coordinates?: {
      lat: number;
      lon: number;
    };
  };
  details?: {
    bedrooms?: number;
    bathrooms?: number;
    sqm?: number;
    sqft?: number;
    rooms?: number;
  };
  features?: string[];
  amenities?: {
    has_parking?: boolean;
    has_balcony?: boolean;
    has_garden?: boolean;
    has_pool?: boolean;
  };
  country_specific?: any;
  images?: string[];
  description?: string;
  url?: string;
  status: string;
}

export interface IngestionPayload {
  portal: string;
  portal_id: string;
  country: string;
  data: StandardProperty;
  raw_data: any;
  status?: string;
}

/**
 * Send property to Core Service
 */
export async function sendToCoreService(payload: IngestionPayload): Promise<void> {
  if (!config.apiKey) {
    logger.debug('No API key configured, skipping Core Service send');
    return;
  }

  try {
    await axios.post(
      `${config.apiUrl}/properties/ingest`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    logger.debug(`Sent property ${payload.portal_id} to Core Service`);
  } catch (error) {
    logger.error(`Failed to send property ${payload.portal_id} to Core Service:`, error);
    throw error;
  }
}

/**
 * Mark property as inactive in Core Service
 */
export async function markPropertyInactive(
  portal: string,
  portalId: string,
  country: string,
  reason: string
): Promise<void> {
  if (!config.apiKey) {
    logger.debug('No API key configured, skipping inactive mark');
    return;
  }

  try {
    await axios.post(
      `${config.apiUrl}/properties/mark-inactive`,
      {
        portal,
        portal_id: portalId,
        country,
        reason,
        inactive_at: new Date().toISOString(),
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    logger.info(`Marked property ${portalId} as inactive in Core Service`);
  } catch (error) {
    logger.error(`Failed to mark property ${portalId} as inactive:`, error);
    throw error;
  }
}
