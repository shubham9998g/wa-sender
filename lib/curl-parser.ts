import { ParsedCurl, DetectedFields, DetectedFieldMedia, DetectedTemplateParam } from '../src/types';

/**
 * Masks sensitive API keys, tokens, or authorization headers.
 * Example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz" -> "eyJh***xyz"
 */
export function maskSecret(secret: string | null | undefined): string {
  if (!secret) return '';
  const s = String(secret).trim();
  if (s.length <= 8) return '****';
  const prefix = s.slice(0, 4);
  const suffix = s.slice(-4);
  return `${prefix}***${suffix}`;
}

/**
 * Deep clones an object and masks sensitive fields (apiKey, authorization, etc.)
 */
export function maskPayloadSecrets(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;

  if (Array.isArray(payload)) {
    return payload.map((item) => maskPayloadSecrets(item));
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('key') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('auth') ||
      lowerKey.includes('password')
    ) {
      if (typeof value === 'string') {
        result[key] = maskSecret(value);
      } else {
        result[key] = '****';
      }
    } else if (typeof value === 'object') {
      result[key] = maskPayloadSecrets(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Normalizes cURL command strings from Linux, macOS, and Windows CMD/PowerShell.
 */
function preprocessCurl(curlString: string): string {
  if (!curlString) return '';

  let normalized = curlString.trim();

  // Replace Windows line continuations (caret ^ followed by optional spaces and newline)
  normalized = normalized.replace(/\^\s*[\r\n]+/g, ' ');

  // Replace Unix line continuations (backslash \ followed by optional spaces and newline)
  normalized = normalized.replace(/\\\s*[\r\n]+/g, ' ');

  // Collapse multiple whitespace/newlines into single space, unless within quotes
  // We normalize carriage returns first
  normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  return normalized;
}

/**
 * Robustly parses a cURL command into its HTTP components.
 */
export function parseCurl(rawCurlInput: string): ParsedCurl {
  const cleanedCurl = preprocessCurl(rawCurlInput);

  let method = 'GET';
  let url = '';
  const headers: Record<string, string> = {};
  let rawBody = '';
  let body: Record<string, any> = {};

  // Extract method: -X POST, -X "POST", --request POST
  const methodMatch = cleanedCurl.match(/(?:-X|--request)\s+['"]?([A-Za-z]+)['"]?/i);
  if (methodMatch) {
    method = methodMatch[1].toUpperCase();
  }

  // Extract headers: -H 'Header: Value' or -H "Header: Value"
  const headerRegex = /(?:-H|--header)\s+(?:'([^']+)'|"([^"]+)")/g;
  let hMatch: RegExpExecArray | null;
  while ((hMatch = headerRegex.exec(cleanedCurl)) !== null) {
    const headerStr = hMatch[1] ?? hMatch[2] ?? '';
    const colonIdx = headerStr.indexOf(':');
    if (colonIdx > 0) {
      const hKey = headerStr.slice(0, colonIdx).trim();
      const hVal = headerStr.slice(colonIdx + 1).trim();
      headers[hKey] = hVal;
    }
  }

  // Extract Body: --data-raw '...', --data-raw "...", -d '...', --data '...'
  // We need to support both single-quoted JSON and double-quoted JSON with escaped quotes (Windows CMD)
  const dataRegex = /(?:--data-raw|--data-binary|--data|-d)\s+/g;
  const dataPosMatch = dataRegex.exec(cleanedCurl);

  if (dataPosMatch) {
    const startIdx = dataPosMatch.index + dataPosMatch[0].length;
    const remaining = cleanedCurl.slice(startIdx).trim();

    if (remaining.startsWith("'")) {
      // Single-quoted string
      const endQuote = remaining.indexOf("'", 1);
      if (endQuote !== -1) {
        rawBody = remaining.slice(1, endQuote);
      } else {
        rawBody = remaining.slice(1);
      }
    } else if (remaining.startsWith('"')) {
      // Double quoted string - might contain escaped quotes \"
      let buffer = '';
      let isEscaped = false;
      let foundEnd = false;

      for (let i = 1; i < remaining.length; i++) {
        const char = remaining[i];
        if (isEscaped) {
          buffer += char;
          isEscaped = false;
        } else if (char === '\\') {
          // Check if next is quote
          if (remaining[i + 1] === '"') {
            buffer += '"';
            i++; // skip escaped quote
          } else {
            buffer += char;
          }
        } else if (char === '"') {
          foundEnd = true;
          break;
        } else {
          buffer += char;
        }
      }
      rawBody = buffer;
    } else {
      // Unquoted data up to next flag or end of string
      const endFlag = remaining.search(/\s+-(?:H|X|-)/);
      rawBody = endFlag !== -1 ? remaining.slice(0, endFlag) : remaining;
    }

    if (method === 'GET') {
      method = 'POST';
    }
  }

  // Extract URL: match http(s)://...
  const urlMatch = cleanedCurl.match(/['"]?(https?:\/\/[^\s'"]+)['"]?/i);
  if (urlMatch) {
    url = urlMatch[1];
  }

  // Parse JSON Body
  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      // Try unescaping if it was double-escaped
      try {
        const unescaped = rawBody.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        body = JSON.parse(unescaped);
      } catch (err) {
        // Keep empty body or partial
        console.warn('Failed to parse cURL body as JSON:', err);
      }
    }
  }

  // Detect fields in body
  const detected = detectCurlFields(body);
  const fields = Object.keys(body);

  return {
    method,
    url,
    headers,
    body,
    rawBody,
    fields,
    detected
  };
}

/**
 * Detects destination, user name, templateParams, and media fields.
 */
export function detectCurlFields(body: Record<string, any>): DetectedFields {
  const result: DetectedFields = {
    templateParams: [],
    media: [],
    otherFields: []
  };

  if (!body || typeof body !== 'object') {
    return result;
  }

  const destinationCandidates = ['destination', 'phone', 'mobile', 'number', 'to', 'recipient'];
  const userNameCandidates = ['username', 'user_name', 'name', 'recipientname'];

  for (const [key, value] of Object.entries(body)) {
    const lowerKey = key.toLowerCase();

    // Destination detection
    if (!result.destinationField && destinationCandidates.includes(lowerKey)) {
      result.destinationField = key;
    }

    // User name detection
    if (!result.userNameField && userNameCandidates.includes(lowerKey)) {
      result.userNameField = key;
    }

    // Template Params detection
    if (lowerKey === 'templateparams' && Array.isArray(value)) {
      value.forEach((val, idx) => {
        result.templateParams.push({
          path: `templateParams[${idx}]`,
          key: 'templateParams',
          index: idx,
          value: val
        });
      });
    }

    // Media detection - CRITICAL REQUIREMENT (Bug 1 to avoid!)
    // If body has "media": ["https://URL", ...], detect media[0], media[1], etc.
    if (lowerKey === 'media') {
      if (Array.isArray(value)) {
        value.forEach((val, idx) => {
          result.media.push({
            path: `${key}[${idx}]`,
            key,
            index: idx,
            value: typeof val === 'string' ? val : JSON.stringify(val)
          });
        });
      } else if (typeof value === 'string') {
        result.media.push({
          path: `${key}[0]`,
          key,
          index: 0,
          value
        });
      } else if (typeof value === 'object' && value !== null) {
        // e.g. "media": { "url": "..." }
        if (value.url) {
          result.media.push({
            path: `${key}.url`,
            key,
            index: 0,
            value: value.url
          });
        }
      }
    }

    // Other non-special keys
    if (
      !destinationCandidates.includes(lowerKey) &&
      !userNameCandidates.includes(lowerKey) &&
      lowerKey !== 'templateparams' &&
      lowerKey !== 'media' &&
      lowerKey !== 'apikey'
    ) {
      result.otherFields.push(key);
    }
  }

  return result;
}
