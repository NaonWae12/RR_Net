import { ApiError, NetworkError } from "../api/apiClient";
import { captureException, captureMessage } from "../monitoring/sentry";

/**
 * Get user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof NetworkError) {
    return error.message;
  }

  if (error instanceof Error) {
    // Don't expose technical error messages in production
    if (process.env.NODE_ENV === "production") {
      return "An unexpected error occurred. Please try again.";
    }
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unexpected error occurred. Please try again.";
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    // Retryable status codes
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    return retryableStatuses.includes(error.statusCode || 0);
  }

  if (error instanceof NetworkError) {
    return true; // Network errors are usually retryable
  }

  return false;
}

/**
 * Get error code for error tracking
 */
export function getErrorCode(error: unknown): string | undefined {
  if (error instanceof ApiError) {
    return error.code;
  }

  if (error instanceof NetworkError) {
    return "NETWORK_ERROR";
  }

  if (error instanceof Error) {
    return error.name;
  }

  return "UNKNOWN_ERROR";
}

/**
 * Log error for debugging and error tracking
 */
export function logError(error: unknown, context?: Record<string, any>) {
  const message = getErrorMessage(error);
  const code = getErrorCode(error);

  console.error("Error:", {
    message,
    code,
    error,
    context,
    timestamp: new Date().toISOString(),
  });

  // Send to error tracking service
  if (error instanceof Error) {
    captureException(error, {
      errorCode: code,
      ...context,
    });
  } else {
    captureMessage(`Error: ${message}`, 'error');
  }
}

/**
 * Format error for display in UI
 */
export function formatErrorForDisplay(error: unknown): {
  title: string;
  message: string;
  action?: string;
} {
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 401:
        return {
          title: "Authentication Required",
          message: "Please log in to continue.",
          action: "Go to Login",
        };
      case 403:
        return {
          title: "Access Denied",
          message: "You don't have permission to perform this action.",
        };
      case 404:
        return {
          title: "Not Found",
          message: "The requested resource was not found.",
        };
      case 429:
        return {
          title: "Too Many Requests",
          message: "Please wait a moment and try again.",
        };
      case 500:
      case 502:
      case 503:
        return {
          title: "Server Error",
          message: "Our servers are experiencing issues. Please try again later.",
        };
      default:
        return {
          title: "Error",
          message: error.message,
        };
    }
  }

  if (error instanceof NetworkError) {
    return {
      title: "Connection Error",
      message: "Please check your internet connection and try again.",
    };
  }

  return {
    title: "Error",
    message: getErrorMessage(error),
  };
}

