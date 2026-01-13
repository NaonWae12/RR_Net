import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { generateUUID } from "../utils";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true, // Enable sending cookies in cross-origin requests
});

// Simple token manager placeholder; real storage handled in auth store
let accessToken: string | null = null;
let tenantSlug: string | null = null;
let refreshToken: string | null = null;
let csrfToken: string | null = null; // CSRF token from backend response header

// Refresh token state to prevent concurrent refresh calls
let isRefreshing = false;
let refreshSubscribers: Array<() => void> = [];

// Callback to get refresh token from auth store
let getRefreshTokenCallback: (() => string | null) | null = null;
let onTokenRefreshedCallback: ((token: string, refreshToken: string) => void) | null = null;
let refreshTokenCallback: (() => Promise<void>) | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const setTenantSlug = (slug: string | null) => {
  tenantSlug = slug;
};

export const setRefreshTokenCallback = (
  getRefresh: () => string | null,
  onRefreshed: (token: string, refreshToken: string) => void,
  refresh: () => Promise<void>
) => {
  getRefreshTokenCallback = getRefresh;
  onTokenRefreshedCallback = onRefreshed;
  refreshTokenCallback = refresh;
};

// Get CSRF token from stored value (set from response header)
function getCSRFToken(): string | null {
  return csrfToken;
}

// Decode JWT token to get expiration time (without verification)
function getTokenExpiration(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.exp ? decoded.exp * 1000 : null; // Convert to milliseconds
  } catch {
    return null;
  }
}

// Check if token is about to expire (less than 2 minutes remaining)
function isTokenExpiringSoon(token: string): boolean {
  const expiration = getTokenExpiration(token);
  if (!expiration) return false;
  
  const now = Date.now();
  const timeUntilExpiry = expiration - now;
  const twoMinutes = 2 * 60 * 1000; // 2 minutes in milliseconds
  
  return timeUntilExpiry > 0 && timeUntilExpiry < twoMinutes;
}

// Process refresh subscribers
function onTokenRefreshed() {
  refreshSubscribers.forEach((callback) => callback());
  refreshSubscribers = [];
}

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
  if (!config.headers) {
    config.headers = new axios.AxiosHeaders();
  }
  
  // Get latest token from authStore if available (for better sync)
  // This ensures we always use the most up-to-date token
  let currentToken = accessToken;
  try {
    // Try to get token from authStore if it's available
    const authStore = (await import("@/stores/authStore")).useAuthStore;
    if (authStore) {
      const state = authStore.getState();
      if (state.token) {
        currentToken = state.token;
        // Sync apiClient token with store token
        if (currentToken !== accessToken) {
          accessToken = currentToken;
        }
      }
    }
  } catch (e) {
    // Ignore - use existing accessToken
  }
    
    // Check if token is about to expire and refresh if needed
    if (currentToken && isTokenExpiringSoon(currentToken) && refreshTokenCallback && getRefreshTokenCallback) {
      const currentRefreshToken = getRefreshTokenCallback();
      
      if (currentRefreshToken && !isRefreshing) {
        isRefreshing = true;
        
        try {
          await refreshTokenCallback();
          // Token should be updated via callback
          // Wait a bit for state to sync
          await new Promise((resolve) => setTimeout(resolve, 100));
          // Re-get token after refresh
          try {
            const authStore = (await import("@/stores/authStore")).useAuthStore;
            if (authStore) {
              const state = authStore.getState();
              if (state.token) {
                currentToken = state.token;
                accessToken = currentToken;
              }
            }
          } catch (e) {
            // Ignore
          }
        } catch (error) {
          // If refresh fails, continue with current token
          // The request will fail with 401 and be handled by response interceptor
          console.error("Token refresh failed:", error);
        } finally {
          isRefreshing = false;
          onTokenRefreshed();
        }
      } else if (isRefreshing) {
        // If refresh is in progress, wait for it to complete
        await new Promise<void>((resolve) => {
          refreshSubscribers.push(() => resolve());
        });
        // Re-get token after refresh completes
        try {
          const authStore = (await import("@/stores/authStore")).useAuthStore;
          if (authStore) {
            const state = authStore.getState();
            if (state.token) {
              currentToken = state.token;
              accessToken = currentToken;
            }
          }
        } catch (e) {
          // Ignore
        }
      }
    }
  
  // Add auth token
  if (currentToken) {
    config.headers.Authorization = `Bearer ${currentToken}`;
  }
  
  // Add tenant slug (only if provided and not empty)
  // Don't send header for super admin (tenantSlug is null)
  if (tenantSlug && tenantSlug.trim() !== '') {
    config.headers['X-Tenant-Slug'] = tenantSlug;
  }
  
  // Add CSRF token for state-changing methods (POST, PUT, PATCH, DELETE)
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (config.method && stateChangingMethods.includes(config.method.toUpperCase())) {
    const url = (config.url ?? '').toString();
    const csrfExemptPaths = [
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/auth/logout',
    ];
    const isExempt = csrfExemptPaths.some((p) => url === p || url.startsWith(p + '?'));

    const token = getCSRFToken();
    if (token) {
      config.headers['X-CSRF-Token'] = token;
    } else {
      // Avoid noisy warnings for CSRF-exempt auth endpoints
      if (!isExempt) {
        console.warn('[CSRF] Token not available for', config.method, config.url);
      }
    }
  }
  
  // Attach request id header for tracing
  if (!config.headers['x-request-id']) {
    config.headers['x-request-id'] = generateUUID();
  }
  
  return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to extract CSRF token from response headers

// Error types for better error handling
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = "NetworkError";
  }
}

// Get user-friendly error message
function getErrorMessage(error: AxiosError): string {
  const status = error?.response?.status;
  const data = error?.response?.data as any;

  // Try to get error message from response
  if (data?.error) {
    return data.error;
  }

  if (data?.message) {
    return data.message;
  }

  // Fallback to status-based messages
  switch (status) {
    case 400:
      return "Invalid request. Please check your input.";
    case 401:
      return "You are not authorized. Please log in again.";
    case 403:
      return "You don't have permission to perform this action.";
    case 404:
      return "The requested resource was not found.";
    case 409:
      return "This resource already exists or conflicts with existing data.";
    case 422:
      return "Validation failed. Please check your input.";
    case 429:
      return "Too many requests. Please try again later.";
    case 500:
      return "Server error. Please try again later.";
    case 502:
    case 503:
      return "Service temporarily unavailable. Please try again later.";
    case 504:
      return "Request timeout. Please try again.";
    default:
      if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
        return "Request timeout. Please check your connection and try again.";
      }
      if (error.code === "ERR_NETWORK" || !error.response) {
        return "Network error. Please check your connection.";
      }
      return "An unexpected error occurred. Please try again.";
  }
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];
const RETRYABLE_CODES = ["ECONNABORTED", "ETIMEDOUT", "ERR_NETWORK"];

// Check if error is retryable
function isRetryableError(error: AxiosError): boolean {
  const status = error?.response?.status;
  const code = error?.code;
  const url = (error?.config?.url ?? "").toString();

  if (status && RETRYABLE_STATUSES.includes(status)) {
    // Do NOT retry 429 for wa-gateway polling endpoints.
    // The backend returns Retry-After; the UI should back off instead of spamming.
    if (status === 429 && url.includes("/wa-gateway/")) {
      return false;
    }
    return true;
  }

  if (code && RETRYABLE_CODES.includes(code)) {
    return true;
  }

  // Network errors are retryable
  if (!error.response) {
    return true;
  }

  return false;
}

// Sleep helper for retries
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

apiClient.interceptors.response.use(
  (response) => {
    // Extract CSRF token from response header (backend sends this on GET requests)
    // Axios normalizes headers to lowercase in response.headers object
    const token = response.headers['x-csrf-token'];
    if (token && typeof token === 'string') {
      csrfToken = token;
      console.log('[CSRF] Token extracted from success response:', token.substring(0, 10) + '...');
    }
    return response;
  },
  async (error: AxiosError) => {
    // CRITICAL: Extract token from error response headers
    // This is important because GET requests might fail with 403 but still have token in header
    // Backend CSRF middleware sets header BEFORE auth/RBAC middleware rejects the request
    const headers = error?.response?.headers;
    if (headers) {
      // Try both lowercase and original case (axios may or may not normalize error headers)
      const token = (headers['x-csrf-token'] || (headers as any)['X-CSRF-Token']) as string | undefined;
      if (token && typeof token === 'string') {
        csrfToken = token;
        console.log('[CSRF] Token extracted from error response:', token.substring(0, 10) + '...');
      } else {
        // Debug: log available headers to see what we have
        console.warn('[CSRF] Token not found in error response headers. Available headers:', Object.keys(headers));
      }
    }
    const originalRequest = error.config as InternalAxiosRequestConfig & { 
      _retry?: boolean;
      _retryCount?: number;
    };

    // Initialize retry count
    if (originalRequest._retryCount === undefined) {
      originalRequest._retryCount = 0;
    }

    const status = error?.response?.status;
    
    // Handle 401 Unauthorized - try to refresh token
    if (status === 401 && !originalRequest._retry && refreshTokenCallback && getRefreshTokenCallback) {
      originalRequest._retry = true;
      const currentRefreshToken = getRefreshTokenCallback();
      
      if (currentRefreshToken && !isRefreshing) {
        isRefreshing = true;
        
        try {
          await refreshTokenCallback();
          await new Promise((resolve) => setTimeout(resolve, 100));
          
          // Get the latest token from authStore after refresh
          let newToken = accessToken;
          try {
            const authStore = (await import("@/stores/authStore")).useAuthStore;
            if (authStore) {
              const state = authStore.getState();
              if (state.token) {
                newToken = state.token;
                accessToken = newToken; // Sync apiClient token
              }
            }
          } catch (e) {
            // Ignore - use existing accessToken
          }
          
          if (newToken && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          
          return apiClient(originalRequest);
        } catch (refreshError) {
          if (onTokenRefreshedCallback) {
            onTokenRefreshedCallback("", "");
          }
          return Promise.reject(
            new ApiError("Session expired. Please log in again.", 401, "SESSION_EXPIRED")
          );
        } finally {
          isRefreshing = false;
          onTokenRefreshed();
        }
      } else if (isRefreshing) {
        return new Promise((resolve) => {
          refreshSubscribers.push(() => {
            if (accessToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            }
            resolve(apiClient(originalRequest));
          });
        });
      }
    }
    
    // Retry logic for transient errors
    if (
      originalRequest &&
      isRetryableError(error) &&
      originalRequest._retryCount < MAX_RETRIES
    ) {
      originalRequest._retryCount++;
      const delay = RETRY_DELAY * originalRequest._retryCount; // Exponential backoff

      console.warn(
        `Request failed, retrying (${originalRequest._retryCount}/${MAX_RETRIES})...`,
        error.message
      );

      await sleep(delay);
      return apiClient(originalRequest);
    }

    // Transform error to ApiError with user-friendly message
    const message = getErrorMessage(error);
    const errorData = error?.response?.data as any;
    const errorCode = errorData?.code ?? (error as any)?.code;
    const apiError = new ApiError(
      message,
      status,
      errorCode,
      errorData
    );

    // Log error for debugging
    if (status && status >= 500) {
      console.error("Server error:", {
        status,
        url: originalRequest?.url,
        method: originalRequest?.method,
        message: apiError.message,
        responseData: error?.response?.data,
        error: error?.response?.data || error?.message || "Unknown error",
      });
    }

    return Promise.reject(apiError);
  }
);

export default apiClient;

