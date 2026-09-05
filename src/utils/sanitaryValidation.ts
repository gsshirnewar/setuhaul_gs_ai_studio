/**
 * Sanitary validation utilities for driver registration and freight operations.
 * Validates Phone Numbers (+91 max 10 digits, no alphabets),
 * Truck Registration Numbers (Indian standard regex), and Email addresses.
 */

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
  formatted?: string;
  cleaned?: string;
}

/**
 * Validates Indian mobile phone numbers:
 * - Max length of 10 digits for the core mobile number
 * - Prefixed with +91 for Indian users
 * - Strictly no alphabets allowed
 * - Checks for valid starting digit (6, 7, 8, or 9)
 */
export function validatePhoneNumber(input: string): ValidationResult {
  const raw = (input || '').trim();

  if (!raw) {
    return { isValid: false, error: 'Phone number is required.' };
  }

  // Check if any alphabet is present
  if (/[a-zA-Z]/.test(raw)) {
    return {
      isValid: false,
      error: 'Phone number cannot contain alphabets. Only digits are allowed.',
    };
  }

  // Check for disallowed special characters (only allow +, -, space, brackets, digits)
  if (/[^0-9+\-\s()]/.test(raw)) {
    return {
      isValid: false,
      error: 'Invalid characters in phone number. Only digits and +91 prefix are allowed.',
    };
  }

  // Extract pure digits
  let digits = raw.replace(/\D/g, '');

  // If user included 91 at the beginning (e.g. +91 or 91) with more than 10 digits
  if (digits.startsWith('91') && digits.length > 10) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length > 10) {
    // Leading 0 trunk prefix
    digits = digits.slice(1);
  }

  // Check core digit count
  if (digits.length === 0) {
    return { isValid: false, error: 'Phone number is required.' };
  }

  if (digits.length < 10) {
    return {
      isValid: false,
      error: `Phone number must be exactly 10 digits (currently ${digits.length} digits).`,
    };
  }

  if (digits.length > 10) {
    return {
      isValid: false,
      error: `Phone number cannot exceed 10 digits (currently ${digits.length} digits).`,
    };
  }

  // Standard Indian mobile numbers start with 6, 7, 8, or 9
  if (!/^[6-9]/.test(digits)) {
    return {
      isValid: false,
      error: 'Valid Indian mobile numbers must start with 6, 7, 8, or 9.',
    };
  }

  // Format with +91 prefix
  const formatted = `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;

  return {
    isValid: true,
    error: null,
    formatted,
    cleaned: digits,
  };
}

/**
 * Validates Indian Truck / Commercial Vehicle Registration numbers.
 * Required Regex after removing whitespace and hyphens:
 * ^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$
 * Examples: RJ14GT4101, DL01RF4115, MH12AB1234, HR26G1234
 */
export function validateTruckRegistration(input: string): ValidationResult {
  const raw = (input || '').trim();

  if (!raw) {
    return { isValid: false, error: 'Truck registration number is required.' };
  }

  // Remove whitespace and hyphens, convert to uppercase
  const cleaned = raw.replace(/[\s-]/g, '').toUpperCase();

  // Test standard Indian vehicle registration regex
  const regex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/;

  if (!regex.test(cleaned)) {
    // Provide specific diagnostic hints
    if (!/^[A-Z]{2}/.test(cleaned)) {
      return {
        isValid: false,
        error: 'Must start with a 2-letter Indian State code (e.g., RJ, MH, DL, KA, HR).',
      };
    }
    if (!/[0-9]{4}$/.test(cleaned)) {
      return {
        isValid: false,
        error: 'Must end with a 4-digit vehicle number (e.g., 4101).',
      };
    }
    return {
      isValid: false,
      error: 'Invalid format. Use standard Indian plate format like RJ14GT4101 or MH12AB1234.',
    };
  }

  return {
    isValid: true,
    error: null,
    cleaned,
    formatted: cleaned,
  };
}

/**
 * Validates email addresses:
 * - Must contain '@' and domain extension (.com, .in, .co.in, etc.)
 * - No whitespace
 * - Valid user and domain structure
 */
export function validateEmail(input: string): ValidationResult {
  const raw = (input || '').trim();

  if (!raw) {
    return { isValid: false, error: 'Email address is required.' };
  }

  if (/\s/.test(raw)) {
    return { isValid: false, error: 'Email address cannot contain spaces.' };
  }

  if (!raw.includes('@')) {
    return { isValid: false, error: "Email address is missing an '@' symbol." };
  }

  const parts = raw.split('@');
  if (parts.length !== 2) {
    return { isValid: false, error: "Email address can only have one '@' symbol." };
  }

  const [localPart, domainPart] = parts;

  if (!localPart || localPart.length === 0) {
    return { isValid: false, error: "Email must have a username before '@'." };
  }

  if (!domainPart || domainPart.length === 0) {
    return { isValid: false, error: "Email must include a domain after '@' (e.g. gmail.com)." };
  }

  if (!domainPart.includes('.')) {
    return { isValid: false, error: "Email domain must include an extension like .com or .in." };
  }

  // Regex requiring standard email structure with recognized top-level domain extensions (.com, .in, etc.)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|in|co\.in|org|net|edu|gov|io|ai|biz|[a-zA-Z]{2,})$/i;

  if (!emailRegex.test(raw)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address with a .com or .in domain (e.g. driver01@gmail.com).',
    };
  }

  return {
    isValid: true,
    error: null,
    cleaned: raw.toLowerCase(),
    formatted: raw.toLowerCase(),
  };
}

/**
 * Validates full name for sanitary sanity check
 */
export function validateFullName(input: string): ValidationResult {
  const raw = (input || '').trim();

  if (!raw) {
    return { isValid: false, error: 'Full name is required.' };
  }

  if (raw.length < 2) {
    return { isValid: false, error: 'Full name must be at least 2 characters.' };
  }

  if (/[0-9]/.test(raw)) {
    return { isValid: false, error: 'Full name cannot contain numbers.' };
  }

  if (/[!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?]/.test(raw)) {
    return { isValid: false, error: 'Full name cannot contain special symbols.' };
  }

  return {
    isValid: true,
    error: null,
    cleaned: raw,
    formatted: raw,
  };
}
