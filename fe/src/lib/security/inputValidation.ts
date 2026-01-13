/**
 * Input validation utilities for security
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (Indonesian format)
 */
export function validatePhone(phone: string): boolean {
  const phoneRegex = /^(\+62|62|0)[0-9]{9,12}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Validate URL
 */
export function validateURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate input length
 */
export function validateLength(
  input: string,
  min: number,
  max: number
): boolean {
  return input.length >= min && input.length <= max;
}

/**
 * Validate against SQL injection patterns
 */
export function validateSQLInjection(input: string): boolean {
  const dangerousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(--|;|\/\*|\*\/|xp_|sp_)/i,
    /(\b(UNION|OR|AND)\b.*\b(SELECT|INSERT|UPDATE|DELETE)\b)/i,
  ];

  return !dangerousPatterns.some((pattern) => pattern.test(input));
}

/**
 * Validate against XSS patterns
 */
export function validateXSS(input: string): boolean {
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];

  return !dangerousPatterns.some((pattern) => pattern.test(input));
}

/**
 * Comprehensive input validation
 */
export function validateInput(
  input: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    type?: 'email' | 'phone' | 'url' | 'text';
    sanitize?: boolean;
  } = {}
): ValidationResult {
  const errors: string[] = [];

  // Required check
  if (options.required && !input.trim()) {
    errors.push('Input is required');
    return { valid: false, errors };
  }

  // Length validation
  if (options.minLength && input.length < options.minLength) {
    errors.push(`Input must be at least ${options.minLength} characters`);
  }
  if (options.maxLength && input.length > options.maxLength) {
    errors.push(`Input must be at most ${options.maxLength} characters`);
  }

  // Type validation
  if (options.type === 'email' && !validateEmail(input)) {
    errors.push('Invalid email format');
  }
  if (options.type === 'phone' && !validatePhone(input)) {
    errors.push('Invalid phone format');
  }
  if (options.type === 'url' && !validateURL(input)) {
    errors.push('Invalid URL format');
  }

  // Security validation
  if (!validateSQLInjection(input)) {
    errors.push('Input contains potentially dangerous content');
  }
  if (!validateXSS(input)) {
    errors.push('Input contains potentially dangerous content');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

