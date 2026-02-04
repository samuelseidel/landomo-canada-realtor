export interface CityCoordinates {
  lat: number;
  lng: number;
  viewport: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface RealtorAPIResponse {
  Results?: Array<any>;
  Paging?: {
    TotalRecords: number;
    CurrentPage: number;
    TotalPages: number;
  };
}

export interface PropertyListing {
  Id: string;
  MlsNumber: string;
  Property?: {
    Price?: number;
    PriceUnformattedValue?: number;
    Type?: string;
    Address?: {
      AddressText?: string;
      CityDistrict?: string;
      PostalCode?: string;
      Latitude?: number;
      Longitude?: number;
    };
    ProvinceName?: string;
    Photo?: Array<{
      HighResPath?: string;
      LowResPath?: string;
      SequenceId?: number;
    }>;
  };
  Building?: {
    Type?: string;
    Bedrooms?: string;
    BathroomTotal?: string;
    SizeInterior?: string;
  };
  Land?: {
    SizeTotal?: string;
  };
  PublicRemarks?: string;
}
