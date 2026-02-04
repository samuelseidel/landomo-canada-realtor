/**
 * Realtor.ca API Client
 * Handles API communication with proper headers and session management
 */

import axios, { AxiosInstance } from 'axios';
import { config } from './config';
import { logger } from './logger';
import { RealtorAPIResponse, PropertyListing } from './types';

export class RealtorClient {
  private client: AxiosInstance;
  private cookies: Record<string, string> = {};
  private sessionInitialized: boolean = false;

  constructor() {
    this.client = axios.create({
      baseURL: config.baseApiUrl,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-CA,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': config.siteUrl,
        'Referer': `${config.siteUrl}/map`,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
    });
  }

  /**
   * Initialize session by visiting the main site
   */
  async initializeSession(): Promise<void> {
    if (this.sessionInitialized) {
      return;
    }

    logger.info('Initializing Realtor.ca session...');

    try {
      const response = await axios.get(`${config.siteUrl}/map`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        maxRedirects: 5,
      });

      // Extract cookies
      const setCookies = response.headers['set-cookie'] || [];
      setCookies.forEach(cookie => {
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        this.cookies[name] = value;
      });

      this.sessionInitialized = true;
      logger.info('Session initialized with cookies');
    } catch (error) {
      logger.error('Failed to initialize session:', error);
      throw error;
    }
  }

  /**
   * Build search parameters for PropertySearch_Post API
   */
  private buildSearchParams(options: {
    latMax: number;
    latMin: number;
    lonMax: number;
    lonMin: number;
    page?: number;
    recordsPerPage?: number;
    transactionType?: number;
    priceMin?: number;
    priceMax?: number;
  }): Record<string, any> {
    const {
      latMax,
      latMin,
      lonMax,
      lonMin,
      page = 1,
      recordsPerPage = config.pageSize,
      transactionType = config.transactionType,
      priceMin,
      priceMax,
    } = options;

    const params: Record<string, any> = {
      ZoomLevel: 11,
      LatitudeMax: latMax,
      LatitudeMin: latMin,
      LongitudeMax: lonMax,
      LongitudeMin: lonMin,
      Sort: '6-D', // Price descending
      PropertyTypeGroupID: 1, // Residential
      PropertySearchTypeId: 1,
      TransactionTypeId: transactionType,
      Currency: 'CAD',
      RecordsPerPage: recordsPerPage,
      CurrentPage: page,
      ApplicationId: 1,
      CultureId: 1, // English
    };

    if (priceMin) params.PriceMin = priceMin;
    if (priceMax) params.PriceMax = priceMax;

    return params;
  }

  /**
   * Search properties by geographic bounds
   */
  async searchProperties(options: {
    latMax: number;
    latMin: number;
    lonMax: number;
    lonMin: number;
    page?: number;
  }): Promise<{ listings: PropertyListing[]; total: number; totalPages: number }> {
    // Ensure session is initialized
    await this.initializeSession();

    const params = this.buildSearchParams(options);

    // Convert to URL-encoded form data
    const formData = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    try {
      const response = await this.client.post<RealtorAPIResponse>(
        config.searchEndpoint,
        formData,
        {
          headers: {
            'Cookie': Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; '),
          },
        }
      );

      if (!response.data || !response.data.Results) {
        return { listings: [], total: 0, totalPages: 0 };
      }

      return {
        listings: response.data.Results,
        total: response.data.Paging?.TotalRecords || 0,
        totalPages: response.data.Paging?.TotalPages || 0,
      };
    } catch (error) {
      logger.error('Property search failed:', error);
      throw error;
    }
  }

  /**
   * Get property details by ID
   */
  async getPropertyDetails(propertyId: string): Promise<any> {
    await this.initializeSession();

    const formData = `PropertyID=${propertyId}&ApplicationId=1&CultureId=1&HashCode=0`;

    try {
      const response = await this.client.post(
        config.detailsEndpoint,
        formData,
        {
          headers: {
            'Cookie': Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; '),
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch details for property ${propertyId}:`, error);
      throw error;
    }
  }

  /**
   * Extract listing IDs from search results
   */
  extractListingIds(listings: PropertyListing[]): string[] {
    return listings
      .filter(l => l.Id || l.MlsNumber)
      .map(l => l.MlsNumber || l.Id);
  }
}
