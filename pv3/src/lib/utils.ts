// lib/utils.ts - Essential utility for className merging
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes with proper precedence
 * Used by shadcn/ui components
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format price in Kenyan Shillings
 */
export function formatPrice(price: number | string): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return `KShs ${numPrice.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Normalize price from various formats
 */
export function normalizePrice(price: string | number | undefined): number {
  if (typeof price === 'string') return parseFloat(price) || 0;
  if (typeof price === 'number') return price;
  return 0;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(str: string, length: number): string {
  return str.length > length ? str.substring(0, length) + '...' : str;
}

/**
 * Get minimum variant price from product
 */
export function getMinVariantPrice(variants: any[]): number {
  if (!variants || variants.length === 0) return 0;

  const prices = variants
    .filter(v => v.is_active)
    .map(v => normalizePrice(v.price));

  return Math.min(...prices);
}