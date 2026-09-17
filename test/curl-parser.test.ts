import { parseCurl, maskSecret, maskPayloadSecrets } from '../lib/curl-parser';
import { normalizePhoneNumber } from '../lib/phone';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('\n--- Running WhatsApp Campaign Manager Tests ---\n');

// 1. Test Linux cURL with media array
const linuxCurl = `curl -X POST "https://api.vartalaap.io/api/v2/broadcast/api/send" \\
-H "Content-Type: application/json" \\
--data-raw '{"apiKey":"SECRET123","campaignName":"10be_certificate","destination":"+919998546899","userName":"Vartalaap","templateParams":["John","Order123"],"source":"API Broadcast","media":["https://URL"],"buttons":[],"carouselCards":[],"location":[],"limitedTimeOffer":[]}'`;

const parsedLinux = parseCurl(linuxCurl);
assert(parsedLinux.method === 'POST', 'Linux cURL method is POST');
assert(parsedLinux.url === 'https://api.vartalaap.io/api/v2/broadcast/api/send', 'Linux cURL URL extracted');
assert(parsedLinux.headers['Content-Type'] === 'application/json', 'Linux cURL header extracted');
assert(parsedLinux.body.campaignName === '10be_certificate', 'Linux cURL body campaignName extracted');
assert(parsedLinux.detected.destinationField === 'destination', 'Linux cURL destination field detected');
assert(parsedLinux.detected.userNameField === 'userName', 'Linux cURL userName field detected');
assert(parsedLinux.detected.templateParams.length === 2, 'Linux cURL templateParams has 2 params detected');
assert(parsedLinux.detected.templateParams[0].path === 'templateParams[0]', 'templateParams[0] detected');
assert(parsedLinux.detected.media.length === 1, 'CRITICAL: media[0] detected and NOT empty');
assert(parsedLinux.detected.media[0].path === 'media[0]', 'media[0] path is correct');
assert(parsedLinux.detected.media[0].value === 'https://URL', 'media[0] value is correct');

// 2. Test Windows cURL with escaped quotes and caret continuations
const windowsCurl = `curl -X POST "https://api.vartalaap.io/api/v2/broadcast/api/send" ^
-H "Content-Type: application/json" ^
--data-raw "{\\"apiKey\\":\\"SECRET123\\",\\"campaignName\\":\\"10be_certificate\\",\\"destination\\":\\"+919998546899\\",\\"userName\\":\\"Vartalaap\\",\\"templateParams\\":[],\\"source\\":\\"API Broadcast\\",\\"media\\":[\\"https://URL1\\",\\"https://URL2\\"],\\"buttons\\":[]}"`;

const parsedWindows = parseCurl(windowsCurl);
assert(parsedWindows.method === 'POST', 'Windows cURL method is POST');
assert(parsedWindows.body.destination === '+919998546899', 'Windows cURL body destination extracted');
assert(parsedWindows.detected.media.length === 2, 'Windows cURL detected both media URLs');
assert(parsedWindows.detected.media[0].path === 'media[0]', 'Windows media[0] detected');
assert(parsedWindows.detected.media[1].path === 'media[1]', 'Windows media[1] detected');

// 3. Test Phone Normalization
const p1 = normalizePhoneNumber('9998546899');
assert(p1.isValid && p1.normalized === '+919998546899', 'Indian 10-digit normalized to +919998546899');

const p2 = normalizePhoneNumber('+919998546899');
assert(p2.isValid && p2.normalized === '+919998546899', '+919998546899 preserves international format');

const p3 = normalizePhoneNumber('919998546899');
assert(p3.isValid && p3.normalized === '+919998546899', '919998546899 normalized with +');

const p4 = normalizePhoneNumber('+91 99985 46899');
assert(p4.isValid && p4.normalized === '+919998546899', 'Phone with spaces normalized to +919998546899');

const p5 = normalizePhoneNumber('+1 415 555 2671');
assert(p5.isValid && p5.normalized === '+14155552671', 'US international phone preserved');

const p6 = normalizePhoneNumber('12345');
assert(!p6.isValid, 'Short invalid phone rejected');

// 4. Test Secret Masking
const maskedKey = maskSecret('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9GMVs');
assert(maskedKey === 'eyJh***GMVs', 'Secret key masked as eyJh***GMVs');

const maskedPayload = maskPayloadSecrets({
  apiKey: 'super-secret-key-12345',
  destination: '+919998546899',
  campaignName: 'test'
});
assert(maskedPayload.apiKey.includes('***'), 'Payload apiKey masked');
assert(maskedPayload.destination === '+919998546899', 'Non-secret field unchanged');

// 5. Test Retry Logic
function isTransientError(statusCode: number): boolean {
  return [408, 409, 425, 429].includes(statusCode) || statusCode >= 500;
}

assert(!isTransientError(400), 'HTTP 400 is permanent error (NO automatic retry)');
assert(!isTransientError(401), 'HTTP 401 is permanent error (NO automatic retry)');
assert(!isTransientError(403), 'HTTP 403 is permanent error (NO automatic retry)');
assert(!isTransientError(404), 'HTTP 404 is permanent error (NO automatic retry)');
assert(!isTransientError(422), 'HTTP 422 is permanent error (NO automatic retry)');

assert(isTransientError(429), 'HTTP 429 is retryable');
assert(isTransientError(500), 'HTTP 500 is retryable');
assert(isTransientError(502), 'HTTP 502 is retryable');
assert(isTransientError(503), 'HTTP 503 is retryable');
assert(isTransientError(408), 'HTTP 408 is retryable');

console.log('\n✨ ALL TESTS PASSED SUCCESSFULLY! ✨\n');
