import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a UUID v4 compatible string
 * Falls back to a simple random string if crypto.randomUUID is not available
 */
export function generateUUID(): string {
  // Try to use crypto.randomUUID if available (Node.js 18.17+ or modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fall through to fallback
    }
  }
  
  // Fallback: Generate a simple UUID-like string
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function formatCurrency(amount: number, compact = false, showDecimals = false): string {
  const fractionDigits = showDecimals ? 2 : 0;
  const formatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  if (compact) {
    if (amount >= 1000000000) {
      const val = (amount / 1000000000);
      return `Rp ${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}M`;
    }
    if (amount >= 1000000) {
      const val = (amount / 1000000);
      return `Rp ${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}JT`;
    }
    if (amount >= 1000) {
      const val = (amount / 1000);
      return `Rp ${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}K`;
    }
  }

  return formatter.format(amount).replace("Rp", "Rp ");
}
