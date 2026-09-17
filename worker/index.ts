import os from 'os';
import { db } from '../lib/db';
import { maskSecret, maskPayloadSecrets } from '../lib/curl-parser';
import { Campaign, CampaignRecord, EventType } from '../src/types';

const WORKER_POLL_MS = parseInt(process.env.WORKER_POLL_MS || '1000', 10);
const DEFAULT_SEND_DELAY_MS = parseInt(process.env.SEND_DELAY_MS || '1000', 10);
const DEFAULT_MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS || '3', 10);
const SERVER_API_KEY = process.env.VARTALAAP_API_KEY || '';

/**
 * Checks if an HTTP status code is considered transient/retryable.
 * 400, 401, 403, 404, 422 are permanent errors: NEVER automatically retry.
 * 408, 409, 425, 429, 500+ are transient errors: retryable up to max_attempts.
 */
function isTransientError(statusCode: number): boolean {
  if ([408, 409, 425, 429].includes(statusCode)) return true;
  if (statusCode >= 500) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Constructs the outbound request payload by merging parsed cURL body with record source data and media.
 */
async function buildRequestPayload(
  campaign: Campaign,
  record: CampaignRecord
): Promise<Record<string, any>> {
  const baseBody = campaign.parsed_template?.body ? JSON.parse(JSON.stringify(campaign.parsed_template.body)) : {};
  const mapping = campaign.field_mapping || {};

  // 1. Destination
  const destination = record.normalized_destination || record.destination;
  const destField = campaign.parsed_template?.detected?.destinationField || 'destination';
  if (destination) {
    baseBody[destField] = destination;
  }

  // 2. User Name
  if (mapping.userName && campaign.parsed_template?.detected?.userNameField) {
    const userNameVal = record.source_data[mapping.userName];
    if (userNameVal !== undefined) {
      baseBody[campaign.parsed_template.detected.userNameField] = String(userNameVal);
    }
  }

  // 3. Dynamic Template Parameters
  if (mapping.templateParams && Array.isArray(baseBody.templateParams)) {
    for (const [paramPath, csvCol] of Object.entries(mapping.templateParams)) {
      // paramPath is e.g. "templateParams[0]"
      const match = paramPath.match(/\[(\d+)\]/);
      if (match) {
        const idx = parseInt(match[1], 10);
        const colVal = record.source_data[csvCol];
        if (colVal !== undefined) {
          baseBody.templateParams[idx] = String(colVal);
        }
      }
    }
  }

  // 4. Media Resolution: Resolve media file to signed Supabase Storage URL
  if (mapping.media) {
    for (const [mediaPath, csvCol] of Object.entries(mapping.media)) {
      const referencedFileName = record.source_data[csvCol] || record.media_source;
      if (referencedFileName) {
        const signedUrl = await db.getMediaUrl(campaign.id, referencedFileName);

        // Replace in baseBody.media[i]
        const match = mediaPath.match(/\[(\d+)\]/);
        if (match && Array.isArray(baseBody.media)) {
          const idx = parseInt(match[1], 10);
          baseBody.media[idx] = signedUrl;
        } else if (Array.isArray(baseBody.media)) {
          baseBody.media[0] = signedUrl;
        } else if (typeof baseBody.media === 'string') {
          baseBody.media = signedUrl;
        }
      }
    }
  }

  // 5. Server Secret Override if configured in environment
  if (SERVER_API_KEY && baseBody.apiKey) {
    baseBody.apiKey = SERVER_API_KEY;
  }

  return baseBody;
}

/**
 * Sends a single WhatsApp message with timeout and error handling.
 */
async function sendWhatsAppRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  payload: Record<string, any>
): Promise<{
  httpStatus: number;
  response: any;
  rawText: string;
  isSuccess: boolean;
  messageId?: string;
  failReason?: string;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const res = await fetch(url, {
      method: method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const httpStatus = res.status;
    const rawText = await res.text();
    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      parsedJson = null;
    }

    // CRITICAL: Any HTTP 200-299 is considered HTTP success!
    const isSuccess = httpStatus >= 200 && httpStatus < 300;

    let messageId: string | undefined = undefined;
    if (parsedJson) {
      messageId =
        parsedJson.messageId ||
        parsedJson.message_id ||
        parsedJson.id ||
        parsedJson?.data?.messageId ||
        parsedJson?.data?.id;
    }

    let failReason: string | undefined = undefined;
    if (!isSuccess) {
      if (parsedJson?.message) {
        failReason = `HTTP ${httpStatus}: ${parsedJson.message}`;
      } else if (parsedJson?.error) {
        failReason = `HTTP ${httpStatus}: ${typeof parsedJson.error === 'string' ? parsedJson.error : JSON.stringify(parsedJson.error)}`;
      } else {
        failReason = `HTTP ${httpStatus}: ${rawText.slice(0, 300) || 'Unknown provider error'}`;
      }
    }

    return {
      httpStatus,
      response: parsedJson || rawText,
      rawText,
      isSuccess,
      messageId: messageId ? String(messageId) : undefined,
      failReason
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    const failReason = isTimeout
      ? 'HTTP Timeout (Request timed out after 30 seconds)'
      : `Network error: ${err.message || 'Connection failed'}`;

    return {
      httpStatus: isTimeout ? 408 : 599,
      response: { error: failReason },
      rawText: failReason,
      isSuccess: false,
      failReason
    };
  }
}

/**
 * Main persistent worker process.
 */
export async function startWorker() {
  const hostname = os.hostname();
  console.log(`\n🚀 [WORKER] Starting WhatsApp Campaign Worker on ${hostname}...`);
  console.log(`[WORKER] Poll Interval: ${WORKER_POLL_MS}ms, Default Delay: ${DEFAULT_SEND_DELAY_MS}ms\n`);

  let isRunning = true;

  process.on('SIGINT', () => {
    console.log('\n[WORKER] Received SIGINT. Gracefully shutting down...');
    isRunning = false;
  });

  process.on('SIGTERM', () => {
    console.log('\n[WORKER] Received SIGTERM. Gracefully shutting down...');
    isRunning = false;
  });

  while (isRunning) {
    try {
      // 1. Update heartbeat
      await db.updateWorkerHeartbeat(hostname);

      // 2. Find campaigns in 'sending' status
      const campaigns = await db.getCampaigns();
      const sendingCampaigns = campaigns.filter((c) => c.status === 'sending');

      await db.updateWorkerHeartbeat(hostname, sendingCampaigns.length);

      if (sendingCampaigns.length === 0) {
        await sleep(WORKER_POLL_MS);
        continue;
      }

      for (const campaign of sendingCampaigns) {
        // Double check status hasn't changed to paused/stopped
        const freshCampaign = await db.getCampaign(campaign.id);
        if (!freshCampaign || freshCampaign.status !== 'sending') {
          continue;
        }

        const maxAttempts = freshCampaign.max_attempts || DEFAULT_MAX_ATTEMPTS;
        const sendDelay = freshCampaign.send_delay_ms || DEFAULT_SEND_DELAY_MS;

        // Atomically claim the next pending approved record
        const record = await db.claimNextPendingRecord(campaign.id);

        if (!record) {
          // No more pending records in this campaign. Check if all are terminal (sent or failed)
          const records = await db.getAllRecords(campaign.id);
          const activeRecords = records.filter(
            (r) => r.approval_status === 'approved' && (r.send_status === 'pending' || r.send_status === 'sending')
          );

          if (activeRecords.length === 0) {
            console.log(`[CAMPAIGN] All records completed for campaign "${campaign.name}" (${campaign.id})`);
            await db.updateCampaign(campaign.id, { status: 'completed' });
            await db.recalculateCampaignCounters(campaign.id);

            // CRITICAL: record_id MUST be null for campaign-level events!
            await db.logEvent(
              campaign.id,
              'completed',
              `Campaign completed. Total records: ${records.length}, Sent: ${records.filter((r) => r.send_status === 'sent').length}, Failed: ${records.filter((r) => r.send_status === 'failed').length}`,
              null
            );
          }
          continue;
        }

        // Process this record
        const attemptNumber = record.attempts + 1;
        console.log(`\n[CAMPAIGN] ${campaign.name} (${campaign.id})`);
        console.log(`[RECORD] #${record.row_number} (ID: ${record.id}) - Attempt ${attemptNumber}/${maxAttempts}`);

        await db.logEvent(
          campaign.id,
          'sending',
          `Sending message to ${record.normalized_destination || record.destination} (Attempt ${attemptNumber}/${maxAttempts})`,
          record.id,
          { rowNumber: record.row_number, attempts: attemptNumber }
        );

        if (!campaign.parsed_template?.url) {
          console.error(`[CAMPAIGN] Missing API URL in cURL configuration`);
          await db.updateRecord(record.id, {
            send_status: 'failed',
            attempts: attemptNumber,
            fail_reason: 'Configuration error: Missing API endpoint URL'
          });
          await db.logEvent(
            campaign.id,
            'failed',
            `Failed: Missing API endpoint URL`,
            record.id
          );
          await db.recalculateCampaignCounters(campaign.id);
          continue;
        }

        // Build Outgoing Request Payload
        const payload = await buildRequestPayload(campaign, record);
        const maskedPayload = maskPayloadSecrets(payload);
        console.log(`[SEND] ${campaign.parsed_template.method} ${campaign.parsed_template.url}`);
        console.log(`[REQUEST PAYLOAD]`, JSON.stringify(maskedPayload, null, 2));

        // Send API Request
        const result = await sendWhatsAppRequest(
          campaign.parsed_template.url,
          campaign.parsed_template.method,
          campaign.parsed_template.headers,
          payload
        );

        console.log(`[PROVIDER] HTTP ${result.httpStatus}`);

        if (result.isSuccess) {
          // Success!
          console.log(`[SENT] Record #${record.row_number} sent successfully. Message ID: ${result.messageId || 'N/A'}`);
          await db.updateRecord(record.id, {
            send_status: 'sent',
            attempts: attemptNumber,
            sent_at: new Date().toISOString(),
            message_id: result.messageId || null,
            provider_status: result.httpStatus,
            provider_response: result.response,
            fail_reason: null
          });

          await db.logEvent(
            campaign.id,
            'sent',
            `Message sent successfully (HTTP ${result.httpStatus})${result.messageId ? ` Message ID: ${result.messageId}` : ''}`,
            record.id,
            { providerStatus: result.httpStatus, messageId: result.messageId }
          );
        } else {
          // Failure
          console.error(`[FAILED] Record #${record.row_number} failed. Reason: ${result.failReason}`);

          const isTransient = isTransientError(result.httpStatus);
          const hasAttemptsRemaining = attemptNumber < maxAttempts;

          if (isTransient && hasAttemptsRemaining) {
            // Transient error: Retry
            console.log(`[RETRY] Record #${record.row_number} is retryable. Setting back to pending for retry.`);
            // Backoff for 429
            if (result.httpStatus === 429) {
              const backoffMs = Math.min(8000, 2000 * Math.pow(2, attemptNumber - 1));
              console.log(`[RETRY] Rate limited (429). Backing off for ${backoffMs}ms...`);
              await sleep(backoffMs);
            }

            await db.updateRecord(record.id, {
              send_status: 'pending', // Set back to pending so worker can pick it up again
              attempts: attemptNumber,
              provider_status: result.httpStatus,
              provider_response: result.response,
              fail_reason: `${result.failReason} (Will retry, attempt ${attemptNumber}/${maxAttempts})`
            });

            await db.logEvent(
              campaign.id,
              'retry',
              `Temporary failure (${result.failReason}). Queued for retry (${attemptNumber}/${maxAttempts}).`,
              record.id,
              { httpStatus: result.httpStatus, attemptNumber }
            );
          } else {
            // Permanent failure or max attempts reached:
            // BUG 3 TO AVOID: send_status = failed, and normal worker does NOT pick it again!
            const reason = !isTransient
              ? `${result.failReason} (Permanent error, no automatic retry)`
              : `${result.failReason} (Max attempts of ${maxAttempts} reached)`;

            await db.updateRecord(record.id, {
              send_status: 'failed',
              attempts: attemptNumber,
              provider_status: result.httpStatus,
              provider_response: result.response,
              fail_reason: reason
            });

            await db.logEvent(
              campaign.id,
              'failed',
              `Record failed permanently: ${reason}`,
              record.id,
              { httpStatus: result.httpStatus, attempts: attemptNumber, response: result.response }
            );
          }
        }

        // Update campaign counters
        await db.recalculateCampaignCounters(campaign.id);

        // Configurable delay between sends
        if (sendDelay > 0) {
          await sleep(sendDelay);
        }
      }
    } catch (loopError: any) {
      console.error('[WORKER] Error in worker loop iteration:', loopError);
      await sleep(2000);
    }
  }

  console.log('[WORKER] Worker stopped.');
}

// Auto-run if executed directly via `node` or `tsx worker/index.ts`
if (process.argv[1]?.endsWith('worker/index.ts') || process.argv[1]?.endsWith('worker/index.js')) {
  startWorker().catch((err) => {
    console.error('[WORKER] Fatal error in worker:', err);
    process.exit(1);
  });
}
