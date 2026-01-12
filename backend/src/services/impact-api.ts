/**
 * Impact.com API Integration
 * Provides access to affiliate campaigns, catalogs, tracking links, and actions
 */

export interface ImpactCampaign {
  id: number;
  name: string;
  advertiser_id: number;
  advertiser_name: string;
  status: string;
  commission_structure?: string;
  cookie_duration?: number;
  description?: string;
  category?: string;
}

export interface ImpactProduct {
  id: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  image_url?: string;
  product_url?: string;
  category?: string;
  brand?: string;
  in_stock?: boolean;
}

export interface ImpactTrackingLink {
  tracking_link: string;
  campaign_id: number;
  original_url: string;
}

export interface ImpactAction {
  id: string;
  campaign_id: number;
  campaign_name: string;
  status: string;
  amount: number;
  currency: string;
  created_date: string;
}

export class ImpactAPIService {
  private accountSid: string;
  private authToken: string;
  private baseUrl = 'https://api.impact.com';

  constructor(accountSid: string, authToken: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
  }

  /**
   * Make authenticated request to Impact.com API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Impact.com uses HTTP Basic Auth
    const authHeader = 'Basic ' + btoa(`${this.accountSid}:${this.authToken}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Impact.com API error (${response.status}): ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Search for affiliate campaigns/programs
   */
  async searchCampaigns(params: {
    query?: string;
    category?: string;
    status?: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  }): Promise<ImpactCampaign[]> {
    try {
      const queryParams = new URLSearchParams();

      if (params.query) queryParams.append('q', params.query);
      if (params.category) queryParams.append('Category', params.category);
      if (params.status) queryParams.append('CampaignState', params.status);

      const endpoint = `/Mediapartners/${this.accountSid}/Campaigns?${queryParams.toString()}`;

      const response = await this.request<{ Campaigns: ImpactCampaign[] }>(endpoint);

      return response.Campaigns || [];
    } catch (error: any) {
      console.error('[Impact API] Error searching campaigns:', error);
      throw error;
    }
  }

  /**
   * Get product catalog for a specific campaign
   */
  async getCampaignProducts(
    campaignId: number,
    params?: {
      search?: string;
      category?: string;
      limit?: number;
    }
  ): Promise<ImpactProduct[]> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.search) queryParams.append('q', params.search);
      if (params?.category) queryParams.append('Category', params.category);
      if (params?.limit) queryParams.append('PageSize', params.limit.toString());

      const endpoint = `/Mediapartners/${this.accountSid}/Catalogs/Items/${campaignId}?${queryParams.toString()}`;

      const response = await this.request<{ Items: ImpactProduct[] }>(endpoint);

      return response.Items || [];
    } catch (error: any) {
      console.error('[Impact API] Error fetching products:', error);
      throw error;
    }
  }

  /**
   * Generate tracking link for a product/URL
   */
  async generateTrackingLink(params: {
    campaign_id: number;
    destination_url: string;
    click_id?: string;
  }): Promise<ImpactTrackingLink> {
    try {
      const endpoint = `/Mediapartners/${this.accountSid}/TrackingLinks`;

      const response = await this.request<ImpactTrackingLink>(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          CampaignId: params.campaign_id,
          DestinationUrl: params.destination_url,
          ClickId: params.click_id,
        }),
      });

      return response;
    } catch (error: any) {
      console.error('[Impact API] Error generating tracking link:', error);
      throw error;
    }
  }

  /**
   * Get conversion actions (sales, leads) for reporting
   */
  async getActions(params: {
    start_date?: string;
    end_date?: string;
    campaign_id?: number;
    status?: string;
  }): Promise<ImpactAction[]> {
    try {
      const queryParams = new URLSearchParams();

      if (params.start_date) queryParams.append('StartDate', params.start_date);
      if (params.end_date) queryParams.append('EndDate', params.end_date);
      if (params.campaign_id) queryParams.append('CampaignId', params.campaign_id.toString());
      if (params.status) queryParams.append('ActionTrackerState', params.status);

      const endpoint = `/Mediapartners/${this.accountSid}/Actions?${queryParams.toString()}`;

      const response = await this.request<{ Actions: ImpactAction[] }>(endpoint);

      return response.Actions || [];
    } catch (error: any) {
      console.error('[Impact API] Error fetching actions:', error);
      throw error;
    }
  }

  /**
   * Search for affiliate programs by product name
   * This combines campaign search with product catalog search
   */
  async searchProgramsByProduct(productName: string): Promise<{
    programs: Array<{
      campaign: ImpactCampaign;
      matching_products: ImpactProduct[];
      commission_info?: string;
    }>;
  }> {
    try {
      // First, search for active campaigns
      const campaigns = await this.searchCampaigns({
        query: productName,
        status: 'ACTIVE',
      });

      // For each campaign, try to find matching products
      const programsWithProducts = await Promise.all(
        campaigns.slice(0, 10).map(async (campaign) => {
          try {
            const products = await this.getCampaignProducts(campaign.id, {
              search: productName,
              limit: 5,
            });

            return {
              campaign,
              matching_products: products,
              commission_info: campaign.commission_structure,
            };
          } catch (error) {
            // If product fetch fails for a campaign, still return the campaign
            return {
              campaign,
              matching_products: [],
              commission_info: campaign.commission_structure,
            };
          }
        })
      );

      // Filter out programs with no matching products
      const relevantPrograms = programsWithProducts.filter(
        (p) => p.matching_products.length > 0 || p.campaign.name.toLowerCase().includes(productName.toLowerCase())
      );

      return {
        programs: relevantPrograms,
      };
    } catch (error: any) {
      console.error('[Impact API] Error searching programs by product:', error);
      throw error;
    }
  }
}
