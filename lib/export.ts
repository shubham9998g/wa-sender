import Papa from 'papaparse';
import { CampaignRecord } from '../src/types';

/**
 * Exports campaign records to a clean, well-formatted CSV string.
 * Merges source CSV data columns with sending results and audit status.
 * Never exports secrets or API keys.
 */
export function exportRecordsToCsv(records: CampaignRecord[]): string {
  if (!records || records.length === 0) {
    return 'row_number,destination,normalized_destination,approval_status,validation_status,send_status\n';
  }

  // Extract all unique source data keys
  const sourceKeysSet = new Set<string>();
  for (const r of records) {
    if (r.source_data && typeof r.source_data === 'object') {
      for (const k of Object.keys(r.source_data)) {
        sourceKeysSet.add(k);
      }
    }
  }
  const sourceKeys = Array.from(sourceKeysSet);

  const flatRows = records.map((r) => {
    const rowObj: Record<string, any> = {
      row_number: r.row_number
    };

    // Add source columns
    for (const k of sourceKeys) {
      rowObj[`source_${k}`] = r.source_data ? r.source_data[k] ?? '' : '';
    }

    // Add delivery & audit fields
    rowObj.destination = r.destination ?? '';
    rowObj.normalized_destination = r.normalized_destination ?? '';
    rowObj.validation_status = r.validation_status;
    rowObj.validation_reason = r.validation_reason ?? '';
    rowObj.approval_status = r.approval_status;
    rowObj.send_status = r.send_status;
    rowObj.attempts = r.attempts;
    rowObj.provider_status = r.provider_status ?? '';
    rowObj.fail_reason = r.fail_reason ?? '';
    rowObj.message_id = r.message_id ?? '';
    rowObj.sent_at = r.sent_at ?? '';

    return rowObj;
  });

  return Papa.unparse(flatRows);
}
