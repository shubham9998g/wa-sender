export interface PhoneValidationResult {
  isValid: boolean;
  original: string;
  normalized: string;
  reason?: string;
}

/**
 * Normalizes phone numbers with special support for Indian numbers and international standard E.164.
 *
 * Examples:
 * - "9998546899" -> "+919998546899" (VALID)
 * - "+919998546899" -> "+919998546899" (VALID)
 * - "919998546899" -> "+919998546899" (VALID)
 * - "+91 99985 46899" -> "+919998546899" (VALID)
 * - "09998546899" -> "+919998546899" (VALID)
 * - "+1 415 555 2671" -> "+14155552671" (VALID - preserved international)
 * - "12345" -> INVALID
 */
export function normalizePhoneNumber(rawInput: any): PhoneValidationResult {
  const original = rawInput === null || rawInput === undefined ? '' : String(rawInput).trim();

  if (!original) {
    return {
      isValid: false,
      original: '',
      normalized: '',
      reason: 'Missing phone number'
    };
  }

  // Remove whitespace, dashes, parentheses, dots
  let cleaned = original.replace(/[\s\-\(\)\.]+/g, '');

  const hasLeadingPlus = cleaned.startsWith('+');
  if (hasLeadingPlus) {
    cleaned = cleaned.substring(1);
  }

  // Ensure cleaned only contains digits
  if (!/^\d+$/.test(cleaned)) {
    return {
      isValid: false,
      original,
      normalized: original,
      reason: 'Phone number contains invalid non-numeric characters'
    };
  }

  let normalized = '';

  if (hasLeadingPlus) {
    // Already explicitly specified international code
    if (cleaned.length < 8 || cleaned.length > 15) {
      return {
        isValid: false,
        original,
        normalized: `+${cleaned}`,
        reason: `Invalid international phone length (${cleaned.length} digits, standard E.164 requires 8-15 digits)`
      };
    }
    normalized = `+${cleaned}`;
  } else if (cleaned.length === 10) {
    // 10-digit number. Standard Indian mobile numbers begin with 6, 7, 8, 9, or standard mobile prefix
    normalized = `+91${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    // 11 digits starting with leading 0 (trunk code in India)
    normalized = `+91${cleaned.substring(1)}`;
  } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
    // 12 digits starting with 91 (India)
    normalized = `+${cleaned}`;
  } else if (cleaned.length >= 11 && cleaned.length <= 15) {
    // Probably full international format without '+'
    normalized = `+${cleaned}`;
  } else {
    return {
      isValid: false,
      original,
      normalized: original,
      reason: `Invalid phone number length (${cleaned.length} digits)`
    };
  }

  // Final sanity check: E.164 format: + followed by 8 to 15 digits
  const digitCount = normalized.replace(/\D/g, '').length;
  if (digitCount < 8 || digitCount > 15) {
    return {
      isValid: false,
      original,
      normalized,
      reason: `Phone number has ${digitCount} digits; valid E.164 must be between 8 and 15 digits`
    };
  }

  return {
    isValid: true,
    original,
    normalized
  };
}

/**
 * Detects duplicate phone numbers across rows without deleting them.
 * Returns a map of normalized phone -> array of 1-based row numbers.
 */
export function findDuplicatePhoneNumbers(
  records: Array<{ rowNumber: number; normalizedPhone?: string | null }>
): Map<string, number[]> {
  const phoneToRows = new Map<string, number[]>();

  for (const record of records) {
    if (!record.normalizedPhone) continue;
    const existing = phoneToRows.get(record.normalizedPhone) || [];
    existing.push(record.rowNumber);
    phoneToRows.set(record.normalizedPhone, existing);
  }

  const duplicatesOnly = new Map<string, number[]>();
  for (const [phone, rows] of phoneToRows.entries()) {
    if (rows.length > 1) {
      duplicatesOnly.set(phone, rows);
    }
  }

  return duplicatesOnly;
}
