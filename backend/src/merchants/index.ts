/**
 * Merchant Adapters Index
 * Export all merchant adapters and types
 */

export * from './types';
export * from './base-adapter';
export * from './rainforest-adapter';
export * from './amazon-hybrid-adapter';
export * from './shopify-adapter';
export * from './gumroad-adapter';

import { BaseMerchantAdapter } from './base-adapter';
import { RainforestAdapter } from './rainforest-adapter';
import { AmazonHybridAdapter } from './amazon-hybrid-adapter';
import { ShopifyAdapter } from './shopify-adapter';
import { GumroadAdapter } from './gumroad-adapter';
import { MerchantEnv } from './types';

/**
 * Adapter factory
 * Creates the appropriate adapter based on merchant key
 */
export class AdapterFactory {
  /**
   * Create an adapter for a specific merchant
   * @param merchantKey Merchant identifier (amazon, shopify, gumroad)
   * @param env Environment variables
   * @param additionalParams Optional parameters (e.g., Shopify credentials)
   */
  static createAdapter(
    merchantKey: string,
    env: MerchantEnv,
    additionalParams?: Record<string, any>
  ): BaseMerchantAdapter {
    switch (merchantKey.toLowerCase()) {
      case 'amazon':
        // Uses custom scraper first, falls back to API if blocked
        return new AmazonHybridAdapter(env);

      case 'rainforest':
        // Explicit API-only adapter (for backwards compatibility)
        return new RainforestAdapter(env);

      case 'shopify':
        if (additionalParams?.shopDomain && additionalParams?.accessToken) {
          return new ShopifyAdapter(
            env,
            additionalParams.shopDomain,
            additionalParams.accessToken
          );
        }
        return new ShopifyAdapter(env);

      case 'gumroad':
        return new GumroadAdapter(env);

      default:
        throw new Error(`Unsupported merchant: ${merchantKey}`);
    }
  }

  /**
   * Get all available merchant keys
   */
  static getAvailableMerchants(): string[] {
    return ['amazon', 'shopify', 'gumroad'];
  }

  /**
   * Check if a merchant is supported
   */
  static isSupported(merchantKey: string): boolean {
    return this.getAvailableMerchants().includes(merchantKey.toLowerCase());
  }
}
