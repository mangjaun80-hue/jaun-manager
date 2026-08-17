const config = require('../config');

class EtsyClient {
  constructor() {
    this.accessToken = config.etsy.tokenJson.access_token;
    this.refreshToken = config.etsy.tokenJson.refresh_token;
    this.shopId = config.etsy.shopId;
    this.baseUrl = 'https://openapi.etsy.com/v3';
    
    // Etsy token needs user_id prefix - extract from refresh_token
    let formattedToken = this.accessToken;
    if (!formattedToken.includes('.')) {
      const userId = this.refreshToken.split('.')[0];
      formattedToken = `${userId}.${this.accessToken}`;
    }
    
    this.headers = {
      'x-api-key': `${config.etsy.keystring}:${config.etsy.secret}`,
      'Authorization': `Bearer ${formattedToken}`,
      'Content-Type': 'application/json'
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers
        }
      });

      if (response.status === 401) {
        console.log('[Etsy] Token expired, attempting refresh...');
        await this.refreshAccessToken();
        return this.request(endpoint, options);
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Etsy API Error ${response.status}: ${error}`);
      }

      return response.json();
    } catch (error) {
      console.error('[Etsy Request Error]:', error.message);
      throw error;
    }
  }

  async refreshAccessToken() {
    const url = 'https://api.etsy.com/v3/public/oauth/token';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.etsy.keystring,
        refresh_token: this.refreshToken
      })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Etsy token');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.headers['Authorization'] = `Bearer ${this.accessToken}`;
    
    console.log('[Etsy] Token refreshed successfully');
  }

  async getShop() {
    return this.request(`/application/shops/${this.shopId}`);
  }

  async getListings(state = 'active', limit = 25, offset = 0) {
    return this.request(
      `/application/shops/${this.shopId}/listings?state=${state}&limit=${limit}&offset=${offset}`
    );
  }

  async getListing(listingId) {
    return this.request(`/application/listings/${listingId}`);
  }

  async getListingImages(listingId) {
    return this.request(`/application/listings/${listingId}/images`);
  }

  async getShopReceipts(limit = 25, offset = 0) {
    return this.request(
      `/application/shops/${this.shopId}/receipts?limit=${limit}&offset=${offset}`
    );
  }

  async getShopReceipt(receiptId) {
    return this.request(`/application/shops/${this.shopId}/receipts/${receiptId}`);
  }

  async replyToReceipt(receiptId, message) {
    return this.request(
      `/application/shops/${this.shopId}/receipts/${receiptId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ message })
      }
    );
  }

  async getListingStats() {
    const listings = await this.getListings('active', 100);
    return {
      totalActive: listings.count,
      listings: listings.results?.map(l => ({
        id: l.listing_id,
        title: l.title,
        price: l.price,
        currency: l.currency_code,
        views: l.views,
        favoriters: l.favoriters
      })) || []
    };
  }

  async getReceiptsSummary() {
    const receipts = await this.getShopReceipts(100);
    const results = receipts.results || [];
    
    let totalRevenue = 0;
    let totalOrders = results.length;
    
    for (const receipt of results) {
      totalRevenue += receipt.grandtotal?.amount || 0;
    }

    return {
      totalOrders,
      totalRevenue: totalRevenue / 100,
      recentOrders: results.slice(0, 5).map(r => ({
        id: r.receipt_id,
        buyer: r.buyer_email,
        total: r.grandtotal?.amount / 100,
        status: r.status,
        date: r.create_timestamp
      }))
    };
  }
}

module.exports = new EtsyClient();
