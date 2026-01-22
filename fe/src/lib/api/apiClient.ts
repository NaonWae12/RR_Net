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

// Refresh token state to prevent concurrent refresh calls
let isRefreshing = false;
let refreshSubscribers: Array<() => void> = [];

// Callback to get refresh token from auth store
let getRefreshTokenCallback: (() => string | null) | null = null;
let onTokenRefreshedCallback: ((token: string, refreshToken: string) => void) | null = null;
let refreshTokenCallback: (() => Promise<void>) | null = null;

// ============================================================================
// CSRF Token Management (HMR-safe)
// ============================================================================
// CSRF token is stored in sessionStorage to survive HMR/Fast Refresh.
// The token is extracted from API responses and proactively fetched when needed.

const CSRF_TOKEN_STORAGE_KEY = 'rrnet_csrf_token';

// CSRF token initialization state
let csrfTokenInitPromise: Promise<string | null> | null = null;
let csrfTokenInitInProgress = false;

// Request queue for state-changing requests waiting for CSRF token
type QueuedRequest = {
  resolve: (token: string | null) => void;
  reject: (error: Error) => void;
};
let csrfTokenQueue: QueuedRequest[] = [];

/**
 * Get CSRF token from sessionStorage (HMR-safe)
 */
function getCSRFToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(CSRF_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Set CSRF token in sessionStorage (HMR-safe)
 */
function setCSRFToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      sessionStorage.setItem(CSRF_TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(CSRF_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors (e.g., private browsing mode)
  }
}

/**
 * Fetch CSRF token from backend by making a lightweight GET request.
 * Uses /auth/me as it's a simple authenticated endpoint that should return the token.
 * Falls back to /clients/stats if /auth/me fails.
 * Uses raw axios to avoid interceptor loops.
 */
async function fetchCSRFToken(): Promise<string | null> {
  // Get current access token for authentication
  let currentToken = accessToken;
  try {
    const authStore = (await import("@/stores/authStore")).useAuthStore;
    if (authStore) {
      const state = authStore.getState();
      if (state.token) {
        currentToken = state.token;
      }
    }
  } catch {
    // Ignore - use existing accessToken
  }

  const headers: Record<string, string> = {};
  if (currentToken) {
    headers.Authorization = `Bearer ${currentToken}`;
  }
  if (tenantSlug && tenantSlug.trim() !== '') {
    headers['X-Tenant-Slug'] = tenantSlug;
  }

  // Try /auth/me first (lightweight, always available when authenticated)
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/me`, {
      withCredentials: true,
      timeout: 5000,
      headers,
    });
    const token = response.headers['x-csrf-token'];
    if (token && typeof token === 'string') {
      return token;
    }
  } catch (error) {
    // Fallback to /clients/stats if /auth/me fails
    try {
      const response = await axios.get(`${API_BASE_URL}/clients/stats`, {
        withCredentials: true,
        timeout: 5000,
        headers,
      });
      const token = response.headers['x-csrf-token'];
      if (token && typeof token === 'string') {
        return token;
      }
    } catch {
      // Both endpoints failed
    }
  }
  return null;
}

/**
 * Ensure CSRF token is available. This function:
 * 1. Checks sessionStorage first (fast path)
 * 2. If missing, fetches from backend (only one fetch at a time)
 * 3. Queues concurrent requests to avoid duplicate fetches
 * 4. Returns a promise that resolves when token is available
 */
async function ensureCSRFToken(): Promise<string | null> {
  // Fast path: token already in storage
  const existingToken = getCSRFToken();
  if (existingToken) {
    return existingToken;
  }

  // If initialization is already in progress, wait for it
  if (csrfTokenInitInProgress && csrfTokenInitPromise) {
    return csrfTokenInitPromise;
  }

  // Start initialization
  csrfTokenInitInProgress = true;
  csrfTokenInitPromise = (async () => {
    try {
      const token = await fetchCSRFToken();
      if (token) {
        setCSRFToken(token);
        // Resolve all queued requests
        csrfTokenQueue.forEach(({ resolve }) => resolve(token));
        csrfTokenQueue = [];
        return token;
      } else {
        // No token available - reject queued requests
        const error = new Error('Failed to obtain CSRF token from backend');
        csrfTokenQueue.forEach(({ reject }) => reject(error));
        csrfTokenQueue = [];
        return null;
      }
    } catch (error) {
      // Fetch failed - reject queued requests
      const err = error instanceof Error ? error : new Error('CSRF token fetch failed');
      csrfTokenQueue.forEach(({ reject }) => reject(err));
      csrfTokenQueue = [];
      throw err;
    } finally {
      csrfTokenInitInProgress = false;
      csrfTokenInitPromise = null;
    }
  })();

  return csrfTokenInitPromise;
}

/**
 * Restore CSRF token from sessionStorage on module initialization.
 * This ensures token is available immediately after HMR/Fast Refresh.
 */
function initializeCSRFToken(): void {
  if (typeof window === 'undefined') return;
  const storedToken = getCSRFToken();
  if (storedToken) {
    // Token exists in storage, no need to fetch
    // It will be validated/refreshed on next API call if needed
  }
  // If no token, it will be fetched on first state-changing request
}

// Initialize on module load (survives HMR)
if (typeof window !== 'undefined') {
  initializeCSRFToken();
}

export const setAccessToken = (token: string | null) => {
  // console.log('[AXIOS] setAccessToken called:', {
  //   hasToken: !!token,
  //   token: token ? token.substring(0, 20) + '...' : null,
  //   stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n'),
  // });
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
  // console.log('[AXIOS] Request interceptor - initial state:', {
  //   url: config.url,
  //   method: config.method,
  //   accessToken: accessToken ? accessToken.substring(0, 20) + '...' : null,
  // });
  try {
    // Try to get token from authStore if it's available
    const authStore = (await import("@/stores/authStore")).useAuthStore;
    if (authStore) {
      const state = authStore.getState();
      // console.log('[AXIOS] Request interceptor - authStore state:', {
      //   url: config.url,
      //   isAuthenticated: state.isAuthenticated,
      //   hasToken: !!state.token,
      //   token: state.token ? state.token.substring(0, 20) + '...' : null,
      // });
      if (state.token) {
        currentToken = state.token;
        // Sync apiClient token with store token
        if (currentToken !== accessToken) {
          // console.log('[AXIOS] Syncing accessToken from authStore');
          accessToken = currentToken;
        }
      } else {
        // console.log('[AXIOS] WARNING: authStore has no token but isAuthenticated might be true:', {
        //   url: config.url,
        //   isAuthenticated: state.isAuthenticated,
        // });
      }
    }
  } catch (e) {
    // console.log('[AXIOS] Error getting token from authStore:', e);
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
    // console.log('[AXIOS] Authorization header set in interceptor:', {
    //   url: config.url,
    //   method: config.method,
    //   hasToken: true,
    //   tokenPreview: currentToken.substring(0, 20) + '...',
    // });
  } else {
    // console.log('[AXIOS] WARNING: No token available in interceptor:', {
    //   url: config.url,
    //   method: config.method,
    //   accessToken: accessToken ? accessToken.substring(0, 20) + '...' : null,
    //   currentToken: null,
    // });
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

    // For non-exempt paths, ensure CSRF token is available before sending request
    if (!isExempt) {
      try {
        const token = await ensureCSRFToken();
    if (token) {
      config.headers['X-CSRF-Token'] = token;
    } else {
          // Token fetch failed - this is a critical error
          const error = new ApiError(
            'CSRF token is required but could not be obtained. Please refresh the page.',
            403,
            'CSRF_TOKEN_MISSING'
          );
          console.error('[CSRF] Failed to obtain token for', config.method, config.url);
          return Promise.reject(error);
        }
      } catch (error) {
        // ensureCSRFToken() threw an error
        const apiError = error instanceof ApiError 
          ? error 
          : new ApiError(
              'Failed to obtain CSRF token. Please check your connection and try again.',
              503,
              'CSRF_TOKEN_FETCH_FAILED'
            );
        console.error('[CSRF] Error ensuring token for', config.method, config.url, error);
        return Promise.reject(apiError);
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
const RETRYABLE_STATUSES = [408, 500, 502, 503, 504]; // Removed 429 - don't retry rate limit errors
const RETRYABLE_CODES = ["ECONNABORTED", "ETIMEDOUT", "ERR_NETWORK"];

// Check if error is retryable
function isRetryableError(error: AxiosError): boolean {
  const status = error?.response?.status;
  const code = error?.code;
  const url = (error?.config?.url ?? "").toString();
  const method = error?.config?.method?.toUpperCase();

  // Do NOT retry 429 (Too Many Requests) - this indicates rate limiting
  // Retrying will only make it worse
  if (status === 429) {
    return false;
  }

  // Do NOT retry 500 errors for POST/PUT/PATCH/DELETE requests
  // These are usually data validation or business logic errors that won't change with retry
  // Only retry 500 for GET requests (which might be transient server issues)
  if (status === 500 && method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return false;
  }

  if (status && RETRYABLE_STATUSES.includes(status)) {
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
      setCSRFToken(token);
      // Only log if token changed (avoid noise)
      const existingToken = getCSRFToken();
      if (existingToken !== token) {
      console.log('[CSRF] Token extracted from success response:', token.substring(0, 10) + '...');
      }
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
        setCSRFToken(token);
        // Only log if token changed (avoid noise)
        const existingToken = getCSRFToken();
        if (existingToken !== token) {
        console.log('[CSRF] Token extracted from error response:', token.substring(0, 10) + '...');
        }
      }
      // Removed noisy warning - token extraction from error responses is opportunistic
    }
    const originalRequest = error.config as InternalAxiosRequestConfig & { 
      _retry?: boolean;
      _retryOnce?: boolean; // Flag for simple token retry (before refresh token logic)
      _retryCount?: number;
    };

    // Initialize retry count
    if (originalRequest._retryCount === undefined) {
      originalRequest._retryCount = 0;
    }

    const status = error?.response?.status;
    
    // Handle 401 Unauthorized - try to refresh token
    // if (status === 401) {
    //   console.log('[401 DEBUG] Unauthorized response:', {
    //     url: originalRequest?.url,
    //     method: originalRequest?.method,
    //     authHeader: originalRequest?.headers?.Authorization || 'MISSING',
    //     hasAuthHeader: !!originalRequest?.headers?.Authorization,
    //     accessToken: accessToken ? accessToken.substring(0, 20) + '...' : null,
    //     _retry: originalRequest._retry,
    //     _retryOnce: originalRequest._retryOnce,
    //   });
    // }
    
    // OPTION A: Retry-once dengan token dari authStore (defensive fix untuk timing issue)
    // Hanya retry sekali jika token tersedia di authStore tapi belum terpasang di request
    if (status === 401 && !originalRequest._retryOnce) {
      originalRequest._retryOnce = true;
      
      try {
        // Ambil token terbaru dari authStore
        const authStore = (await import("@/stores/authStore")).useAuthStore;
        if (authStore) {
          const state = authStore.getState();
          const token = state.token;
          
          if (token) {
            // console.log('[401 RETRY] Retrying once with token from authStore:', {
            //   url: originalRequest?.url,
            //   method: originalRequest?.method,
            // });
            
            // Set token di header dan retry sekali
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            // Sync accessToken variable juga
            accessToken = token;
            
            // Retry request sekali
            return apiClient(originalRequest);
          }
        }
      } catch (e) {
        // Ignore error, fall through to refresh token logic
        // console.log('[401 RETRY] Failed to get token from authStore, falling through to refresh logic');
      }
    }
    
    // Handle 401 Unauthorized - try to refresh token (existing logic)
    // SAFETY NET: Dashboard endpoints are best-effort, don't trigger logout on 401
    // Only critical auth endpoints should trigger logout
    const url = (originalRequest?.url ?? '').toString();
    const isDashboardEndpoint = 
      url.includes('/clients/stats') ||
      url.includes('/my/plan') ||
      url.includes('/my/features') ||
      url.includes('/my/limits') ||
      url.includes('/tenant/me');
    
    const isCriticalAuthEndpoint = 
      url.includes('/auth/me') ||
      url.includes('/auth/logout');
    
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
          // Only trigger logout for critical auth endpoints
          // Dashboard endpoints should fail gracefully without logout
          if (isCriticalAuthEndpoint) {
            if (onTokenRefreshedCallback) {
              onTokenRefreshedCallback("", "");
            }
            return Promise.reject(
              new ApiError("Session expired. Please log in again.", 401, "SESSION_EXPIRED")
            );
          } else {
            // For dashboard endpoints, just reject with error but don't trigger logout
            return Promise.reject(
              new ApiError(
                isDashboardEndpoint 
                  ? "Dashboard data unavailable. Auth may not be ready yet."
                  : "Unauthorized. Please check your authentication.",
                401,
                isDashboardEndpoint ? "DASHBOARD_UNAUTHORIZED" : "UNAUTHORIZED"
              )
            );
          }
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
    
    // If 401 and no refresh token available, only trigger logout for critical endpoints
    if (status === 401 && !originalRequest._retry && (!refreshTokenCallback || !getRefreshTokenCallback || !getRefreshTokenCallback())) {
      if (isCriticalAuthEndpoint) {
        return Promise.reject(
          new ApiError("Session expired. Please log in again.", 401, "SESSION_EXPIRED")
        );
      } else if (isDashboardEndpoint) {
        // Dashboard endpoints fail gracefully without logout
        return Promise.reject(
          new ApiError("Dashboard data unavailable. Auth may not be ready yet.", 401, "DASHBOARD_UNAUTHORIZED")
        );
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

