/**
 * PII Masking Utility (Phase 5)
 *
 * Masks personally identifiable information in logs.
 * Used to ensure compliance and protect customer privacy.
 *
 * Masks:
 * - Phone numbers (e.g., +1234567890 → +1***890)
 * - Email addresses (e.g., john@example.com → j***@e***.com)
 * - Names (optional, context-dependent)
 * - Credit card numbers (if present)
 */

// ============================================================================
// Masking Functions
// ============================================================================

/**
 * Mask a phone number, keeping first 2 and last 3 digits visible.
 * Examples:
 *   +12025551234 → +12***234
 *   972501234567 → 972***567
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 6) return phone;

  // Remove all non-digit characters for processing
  const digits = phone.replace(/\D/g, '');

  if (digits.length < 6) return phone;

  // Keep first 2-3 and last 3 digits
  const prefix = digits.slice(0, 3);
  const suffix = digits.slice(-3);

  return `${prefix}***${suffix}`;
}

/**
 * Mask an email address.
 * Examples:
 *   john.doe@example.com → j***@e***.com
 *   test@test.io → t***@t***.io
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;

  const [localPart, domain] = email.split('@');

  if (!localPart || !domain) return email;

  const maskedLocal = localPart.charAt(0) + '***';
  const domainParts = domain.split('.');
  const maskedDomain = domainParts[0].charAt(0) + '***' +
    (domainParts.length > 1 ? '.' + domainParts.slice(-1)[0] : '');

  return `${maskedLocal}@${maskedDomain}`;
}

/**
 * Mask a credit card number (if accidentally logged).
 * Examples:
 *   4111111111111111 → ****1111
 *   4111-1111-1111-1111 → ****1111
 */
export function maskCreditCard(cc: string): string {
  if (!cc) return cc;

  const digits = cc.replace(/\D/g, '');

  if (digits.length < 12) return cc; // Not a valid CC

  return '****' + digits.slice(-4);
}

/**
 * Mask a name (partial masking).
 * Examples:
 *   John Doe → J*** D***
 *   Alice → A***
 */
export function maskName(name: string): string {
  if (!name) return name;

  return name
    .split(' ')
    .map(part => {
      if (part.length <= 1) return part;
      return part.charAt(0) + '***';
    })
    .join(' ');
}

// ============================================================================
// Pattern Matchers
// ============================================================================

// Phone number patterns (international formats)
const PHONE_PATTERNS = [
  /\+?\d{1,4}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, // General intl
  /\b\d{10,15}\b/g, // Plain digits
];

// Email pattern
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Credit card patterns
const CC_PATTERNS = [
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Standard format
  /\b\d{16}\b/g, // Plain digits
];

// ============================================================================
// Main Masking Function
// ============================================================================

export interface MaskingOptions {
  maskPhones?: boolean;
  maskEmails?: boolean;
  maskCreditCards?: boolean;
  preserveLength?: boolean;
}

/**
 * Mask all PII in a string.
 * Automatically detects and masks phone numbers, emails, and credit cards.
 */
export function maskPII(
  text: string,
  options: MaskingOptions = {}
): string {
  const {
    maskPhones = true,
    maskEmails = true,
    maskCreditCards = true,
  } = options;

  let result = text;

  // Mask credit cards first (more specific pattern)
  if (maskCreditCards) {
    for (const pattern of CC_PATTERNS) {
      result = result.replace(pattern, match => maskCreditCard(match));
    }
  }

  // Mask phone numbers
  if (maskPhones) {
    for (const pattern of PHONE_PATTERNS) {
      result = result.replace(pattern, match => {
        // Don't mask if it looks like a price or ID
        if (match.includes('$') || match.includes('#')) return match;
        return maskPhoneNumber(match);
      });
    }
  }

  // Mask emails
  if (maskEmails) {
    result = result.replace(EMAIL_PATTERN, match => maskEmail(match));
  }

  return result;
}

/**
 * Create a safe-to-log version of an object.
 * Recursively masks PII in all string values.
 */
export function maskObjectPII<T extends Record<string, unknown>>(
  obj: T,
  sensitiveKeys: string[] = ['phone', 'email', 'whatsapp', 'number', 'card']
): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    if (typeof value === 'string') {
      // Check if this is a known sensitive field
      const isSensitiveKey = sensitiveKeys.some(sk => lowerKey.includes(sk));

      if (isSensitiveKey) {
        // Mask based on field type
        if (lowerKey.includes('email')) {
          result[key] = maskEmail(value);
        } else if (lowerKey.includes('phone') || lowerKey.includes('whatsapp') || lowerKey.includes('number')) {
          result[key] = maskPhoneNumber(value);
        } else if (lowerKey.includes('card')) {
          result[key] = maskCreditCard(value);
        } else {
          result[key] = maskPII(value);
        }
      } else {
        // Still check for inline PII
        result[key] = maskPII(value);
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = maskObjectPII(value as Record<string, unknown>, sensitiveKeys);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'string' ? maskPII(item) :
        typeof item === 'object' && item ? maskObjectPII(item as Record<string, unknown>, sensitiveKeys) :
        item
      );
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

// ============================================================================
// Structured Logging Helper
// ============================================================================

export interface LogContext {
  leadId?: string;
  businessId?: string;
  action?: string;
  intent?: string;
  [key: string]: unknown;
}

/**
 * Create a safe log entry with masked PII.
 * Use this instead of console.log for sensitive data.
 */
export function safeLog(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  context?: LogContext
): void {
  const timestamp = new Date().toISOString();
  const maskedContext = context ? maskObjectPII(context) : undefined;

  const logEntry = {
    timestamp,
    level,
    message: maskPII(message),
    ...maskedContext,
  };

  // Use appropriate console method
  switch (level) {
    case 'error':
      console.error(JSON.stringify(logEntry));
      break;
    case 'warn':
      console.warn(JSON.stringify(logEntry));
      break;
    case 'debug':
      console.debug(JSON.stringify(logEntry));
      break;
    default:
      console.log(JSON.stringify(logEntry));
  }
}
