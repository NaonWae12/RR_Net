/**
 * Sentry Error Tracking Integration
 * 
 * To enable Sentry:
 * 1. Install: npm install @sentry/nextjs
 * 2. Set SENTRY_DSN in .env.local
 * 3. Run: npx @sentry/wizard@latest -i nextjs
 * 4. Uncomment the code below
 */

let sentryInitialized = false;

export function initSentry() {
  // Only initialize in browser
  if (typeof window === 'undefined') {
    return;
  }

  // Check if Sentry DSN is configured
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  // Uncomment when Sentry is installed:
  /*
  import * as Sentry from '@sentry/nextjs';

  Sentry.init({
    dsn: dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      new Sentry.BrowserTracing(),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    beforeSend(event, hint) {
      // Filter out development errors
      if (process.env.NODE_ENV === 'development') {
        return null;
      }
      return event;
    },
  });

  sentryInitialized = true;
  */
}

export function captureException(error: Error, context?: Record<string, any>) {
  if (!sentryInitialized) {
    console.error('Sentry not initialized. Error:', error, context);
    return;
  }

  // Uncomment when Sentry is installed:
  /*
  import * as Sentry from '@sentry/nextjs';
  Sentry.captureException(error, {
    extra: context,
  });
  */
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (!sentryInitialized) {
    console.log(`[${level.toUpperCase()}] ${message}`);
    return;
  }

  // Uncomment when Sentry is installed:
  /*
  import * as Sentry from '@sentry/nextjs';
  Sentry.captureMessage(message, level);
  */
}

export function setUser(user: { id: string; email?: string; username?: string }) {
  if (!sentryInitialized) {
    return;
  }

  // Uncomment when Sentry is installed:
  /*
  import * as Sentry from '@sentry/nextjs';
  Sentry.setUser(user);
  */
}

export function clearUser() {
  if (!sentryInitialized) {
    return;
  }

  // Uncomment when Sentry is installed:
  /*
  import * as Sentry from '@sentry/nextjs';
  Sentry.setUser(null);
  */
}

