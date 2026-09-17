import { Campaign, CampaignRecord, CampaignMedia, ValidationStatus } from '../src/types';
import { normalizePhoneNumber, findDuplicatePhoneNumbers } from './phone';
import { validateRecordMedia } from './media';

export interface RecordValidationResult {
  recordId: string;
  rowNumber: number;
  validationStatus: ValidationStatus;
  validationReason: string | null;
  normalizedDestination: string | null;
}

export interface CampaignReadinessCheck {
  isReady: boolean;
  blockers: string[];
  checklist: {
    csvImported: boolean;
    phoneMapped: boolean;
    curlParsed: boolean;
    templateMapped: boolean;
    mediaValidated: boolean;
    approvedRecordsCount: number;
    totalRecordsCount: number;
  };
}

/**
 * Validates all records of a campaign against phone rules, duplicates, and media files.
 */
export function validateAllCampaignRecords(
  records: CampaignRecord[],
  campaign: Campaign,
  mediaList: CampaignMedia[]
): RecordValidationResult[] {
  const destinationColumn = campaign.field_mapping?.destination;
  const mediaColumn = campaign.field_mapping?.media?.['media[0]'] || campaign.field_mapping?.media?.media;

  // Build quick media lookup map (case-insensitive)
  const mediaMap = new Map<string, CampaignMedia>();
  for (const m of mediaList) {
    mediaMap.set(m.original_name, m);
    mediaMap.set(m.original_name.toLowerCase(), m);
  }

  // Pre-normalize phones to detect duplicates
  const phoneItems = records.map((r) => {
    const rawPhone = destinationColumn ? r.source_data[destinationColumn] : r.destination;
    const phoneNorm = normalizePhoneNumber(rawPhone);
    return {
      record: r,
      rawPhone,
      phoneNorm,
      rowNumber: r.row_number
    };
  });

  const duplicateMap = findDuplicatePhoneNumbers(
    phoneItems.map((p) => ({
      rowNumber: p.rowNumber,
      normalizedPhone: p.phoneNorm.isValid ? p.phoneNorm.normalized : null
    }))
  );

  const results: RecordValidationResult[] = [];

  for (const item of phoneItems) {
    const r = item.record;
    const reasons: string[] = [];
    let status: ValidationStatus = 'valid';
    let normalizedPhone: string | null = null;

    // 1. Phone validation
    if (!destinationColumn && !r.destination) {
      status = 'invalid';
      reasons.push('Destination phone column is not mapped');
    } else if (!item.phoneNorm.isValid) {
      status = 'invalid';
      reasons.push(item.phoneNorm.reason || 'Invalid phone number format');
    } else {
      normalizedPhone = item.phoneNorm.normalized;
      // Check duplicates
      const dupRows = duplicateMap.get(normalizedPhone);
      if (dupRows && dupRows.length > 1) {
        // Warning for duplicates
        if (status === 'valid') status = 'warning';
        reasons.push(`Duplicate phone number (also appears in row${dupRows.length > 2 ? 's' : ''} ${dupRows.filter((row) => row !== item.rowNumber).join(', ')})`);
      }
    }

    // 2. Media validation
    if (mediaColumn) {
      const referencedFile = r.source_data[mediaColumn] || r.media_source;
      if (referencedFile) {
        const mediaCheck = validateRecordMedia(referencedFile, mediaMap);
        if (!mediaCheck.exists) {
          status = 'invalid';
          reasons.push(mediaCheck.reason || `Media file "${referencedFile}" not found in uploaded media`);
        }
      }
    }

    results.push({
      recordId: r.id,
      rowNumber: r.row_number,
      validationStatus: status,
      validationReason: reasons.length > 0 ? reasons.join('; ') : null,
      normalizedDestination: normalizedPhone
    });
  }

  return results;
}

/**
 * Checks if the campaign is ready to start sending.
 */
export function checkCampaignReadiness(
  campaign: Campaign,
  records: CampaignRecord[],
  mediaList: CampaignMedia[]
): CampaignReadinessCheck {
  const blockers: string[] = [];

  const csvImported = records.length > 0;
  if (!csvImported) {
    blockers.push('No CSV or contact records loaded');
  }

  const phoneMapped = Boolean(campaign.field_mapping?.destination);
  if (!phoneMapped) {
    blockers.push('Destination phone field is not mapped to any CSV column');
  }

  const curlParsed = Boolean(campaign.parsed_template && campaign.parsed_template.url);
  if (!curlParsed) {
    blockers.push('WhatsApp API cURL request has not been parsed or is missing API URL');
  }

  // Template Params check: if cURL has templateParams, check if mapped
  let templateMapped = true;
  if (campaign.parsed_template?.detected?.templateParams?.length) {
    const totalParams = campaign.parsed_template.detected.templateParams.length;
    const mappedCount = Object.keys(campaign.field_mapping?.templateParams || {}).length;
    if (mappedCount < totalParams) {
      templateMapped = false;
      blockers.push(`Template parameters incomplete (${mappedCount}/${totalParams} mapped)`);
    }
  }

  // Media check: if cURL requires media
  let mediaValidated = true;
  if (campaign.parsed_template?.detected?.media?.length) {
    const mediaMapped = Boolean(
      campaign.field_mapping?.media?.['media[0]'] ||
      campaign.field_mapping?.media?.media ||
      Object.keys(campaign.field_mapping?.media || {}).length > 0
    );

    if (!mediaMapped) {
      mediaValidated = false;
      blockers.push('Media field is in cURL but not mapped to a CSV file column');
    } else {
      // Check if any approved record has missing media
      const mediaMap = new Map<string, CampaignMedia>();
      for (const m of mediaList) {
        mediaMap.set(m.original_name, m);
        mediaMap.set(m.original_name.toLowerCase(), m);
      }

      const mediaCol = campaign.field_mapping.media?.['media[0]'] || campaign.field_mapping.media?.media;
      const approvedWithMissing = records.filter((r) => {
        if (r.approval_status !== 'approved') return false;
        const ref = r.source_data[mediaCol] || r.media_source;
        if (!ref) return false;
        return !mediaMap.has(ref) && !mediaMap.has(ref.toLowerCase());
      });

      if (approvedWithMissing.length > 0) {
        mediaValidated = false;
        blockers.push(`${approvedWithMissing.length} approved record(s) have missing media files`);
      }
    }
  }

  // Approved records check
  const approvedRecordsCount = records.filter((r) => r.approval_status === 'approved').length;
  if (approvedRecordsCount === 0) {
    blockers.push('No records approved yet. You must approve at least 1 record before starting');
  }

  // Check invalid records approved by mistake
  const invalidApprovedCount = records.filter(
    (r) => r.approval_status === 'approved' && r.validation_status === 'invalid'
  ).length;
  if (invalidApprovedCount > 0) {
    blockers.push(`${invalidApprovedCount} record(s) marked as invalid are approved. Please fix or reject them`);
  }

  const isReady = blockers.length === 0;

  return {
    isReady,
    blockers,
    checklist: {
      csvImported,
      phoneMapped,
      curlParsed,
      templateMapped,
      mediaValidated,
      approvedRecordsCount,
      totalRecordsCount: records.length
    }
  };
}
