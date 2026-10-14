// src/services/PurchaseService.ts
import type { Purchase, PurchaseHistoryResponse } from '../components/types/purchase';

// Use the environment variable with correct name
const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Helper to get CSRF token from cookies
const getCSRFToken = (): string => {
  const name = 'csrftoken';
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) {
      return value;
    }
  }
  return '';
};

// Helper to get auth headers
const getHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  const csrfToken = getCSRFToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;
  }
  
  return headers;
};

// Helper to handle fetch responses
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 403) {
    console.error('🔒 403 Forbidden - Authentication failed');
    // Try to refresh CSRF token
    await refreshCSRFToken();
    throw new Error('Authentication failed. Please refresh and try again.');
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// Helper to refresh CSRF token
const refreshCSRFToken = async (): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/csrf-token/`, {
      method: 'GET',
      credentials: 'include',
    });
    if (response.ok) {
      console.log('✅ CSRF Token refreshed');
    }
  } catch (error) {
    console.error('❌ Failed to refresh CSRF token:', error);
  }
};

export const purchaseService = {
  /**
   * Get all purchases for a user
   */
  async getUserPurchases(userId: string): Promise<PurchaseHistoryResponse> {
    try {
      console.log(`📦 Fetching purchases for user: ${userId}`);
      
      const response = await fetch(`${API_URL}/purchases/user/${userId}/`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include', // ✅ CRITICAL: Send cookies
      });
      return handleResponse<PurchaseHistoryResponse>(response);
    } catch (error) {
      console.error('Error fetching purchase history:', error);
      throw error;
    }
  },

  /**
   * Get a single purchase by ID
   */
  async getPurchaseById(purchaseId: string): Promise<Purchase> {
    try {
      const response = await fetch(`${API_URL}/purchases/${purchaseId}/`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include', // ✅ CRITICAL: Send cookies
      });
      return handleResponse<Purchase>(response);
    } catch (error) {
      console.error('Error fetching purchase:', error);
      throw error;
    }
  },

  /**
   * Get purchase statistics for a user
   */
  async getPurchaseStats(userId: string): Promise<{
    totalSpent: number;
    totalOrders: number;
    averageOrderValue: number;
    lastOrderDate: string | null;
  }> {
    try {
      console.log(`📊 Fetching stats for user: ${userId}`);
      
      const response = await fetch(`${API_URL}/purchases/stats/${userId}/`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include', // ✅ CRITICAL: Send cookies
      });
      return handleResponse(response);
    } catch (error) {
      console.error('Error fetching purchase stats:', error);
      throw error;
    }
  },

  /**
   * Get purchases by status
   */
  async getPurchasesByStatus(userId: string, status: string): Promise<Purchase[]> {
    try {
      const response = await fetch(`${API_URL}/purchases/user/${userId}/status/${status}/`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include', // ✅ CRITICAL: Send cookies
      });
      const data = await handleResponse<PurchaseHistoryResponse>(response);
      return data.purchases;
    } catch (error) {
      console.error(`Error fetching purchases with status ${status}:`, error);
      throw error;
    }
  },

  /**
   * Get recent purchases (last 30 days)
   */
  async getRecentPurchases(userId: string, _days: number = 30): Promise<Purchase[]> {
    try {
      const response = await fetch(`${API_URL}/purchases/user/${userId}/recent/`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include', // ✅ CRITICAL: Send cookies
      });
      const data = await handleResponse<PurchaseHistoryResponse>(response);
      return data.purchases;
    } catch (error) {
      console.error('Error fetching recent purchases:', error);
      throw error;
    }
  }
};

export default purchaseService;