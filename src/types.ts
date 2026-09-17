export type CampaignStatus = 'draft' | 'ready' | 'sending' | 'paused' | 'stopped' | 'completed';
export type RecordSendStatus = 'pending' | 'sending' | 'sent' | 'failed';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ValidationStatus = 'pending' | 'valid' | 'invalid' | 'warning';

export type EventType =
  | 'campaign_created'
  | 'campaign_started'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'retry'
  | 'paused'
  | 'resumed'
  | 'stopped'
  | 'completed'
  | 'validation_error'
  | 'media_missing'
  | 'approval_changed';

export interface FieldMapping {
  destination?: string;
  userName?: string;
  templateParams?: Record<string, string>; // e.g. "templateParams[0]": "customer_name"
  media?: Record<string, string>; // e.g. "media[0]": "file_name"
  [key: string]: any;
}

export interface DetectedFieldMedia {
  path: string;
  key: string;
  index: number;
  value: string;
}

export interface DetectedTemplateParam {
  path: string;
  key: string;
  index: number;
  value: any;
}

export interface DetectedFields {
  destinationField?: string;
  userNameField?: string;
  templateParams: DetectedTemplateParam[];
  media: DetectedFieldMedia[];
  otherFields: string[];
}

export interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: Record<string, any>;
  rawBody: string;
  fields: string[];
  detected: DetectedFields;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  original_file_name: string | null;
  parsed_template: ParsedCurl | null;
  field_mapping: FieldMapping;
  total_records: number;
  approved_records: number;
  sent_count: number;
  failed_count: number;
  pending_count: number;
  send_delay_ms: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignRecord {
  id: string;
  campaign_id: string;
  row_number: number;
  source_data: Record<string, any>;
  destination: string | null;
  normalized_destination: string | null;
  approval_status: ApprovalStatus;
  validation_status: ValidationStatus;
  validation_reason: string | null;
  media_source: string | null;
  media_storage_path: string | null;
  media_url: string | null;
  send_status: RecordSendStatus;
  attempts: number;
  queued_at: string | null;
  sent_at: string | null;
  message_id: string | null;
  provider_status: number | null;
  provider_response: any;
  fail_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignMedia {
  id: string;
  campaign_id: string;
  original_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  checksum: string | null;
  created_at: string;
  url?: string;
}

export interface CampaignEvent {
  id: string;
  campaign_id: string;
  record_id: string | null; // Nullable for campaign-level events!
  event_type: EventType;
  message: string | null;
  data: any;
  created_at: string;
}

export interface WorkerHeartbeat {
  id: string;
  last_seen: string;
  hostname?: string;
  active_campaigns?: number;
  online?: boolean;
}

export interface SendResult {
  success: boolean;
  httpStatus: number;
  response: any;
  messageId?: string;
  error?: string;
  retryable?: boolean;
}
