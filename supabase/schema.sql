-- WhatsApp Campaign Manager
-- Supabase PostgreSQL Schema

-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- 1. Campaigns Table
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft', -- draft, ready, sending, paused, stopped, completed
  original_file_name text,
  parsed_template jsonb,
  field_mapping jsonb default '{}'::jsonb,
  total_records integer not null default 0,
  approved_records integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  pending_count integer not null default 0,
  send_delay_ms integer not null default 1000,
  max_attempts integer not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Campaign Records Table
create table if not exists campaign_records (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null
    references campaigns(id)
    on delete cascade,
  row_number integer not null,
  source_data jsonb not null default '{}'::jsonb,
  destination text,
  normalized_destination text,
  approval_status text not null default 'pending', -- pending, approved, rejected
  validation_status text not null default 'pending', -- pending, valid, invalid, warning
  validation_reason text,
  media_source text,
  media_storage_path text,
  media_url text,
  send_status text not null default 'pending', -- pending, sending, sent, failed
  attempts integer not null default 0,
  queued_at timestamptz,
  sent_at timestamptz,
  message_id text,
  provider_status integer,
  provider_response jsonb,
  fail_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id, row_number)
);

-- 3. Campaign Media Table
create table if not exists campaign_media (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null
    references campaigns(id)
    on delete cascade,
  original_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  checksum text,
  created_at timestamptz not null default now(),
  unique(campaign_id, original_name)
);

-- 4. Campaign Events (Logs) Table
-- Notice: record_id MUST be nullable to avoid foreign-key errors for campaign-level events!
create table if not exists campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null
    references campaigns(id)
    on delete cascade,
  record_id uuid
    references campaign_records(id)
    on delete cascade,
  event_type text not null, -- campaign_started, sending, sent, failed, retry, paused, resumed, stopped, completed, validation_error, media_missing
  message text,
  data jsonb,
  created_at timestamptz not null default now()
);

-- 5. Worker Heartbeat Table
create table if not exists worker_heartbeat (
  id text primary key default 'primary',
  last_seen timestamptz not null default now(),
  hostname text,
  active_campaigns integer default 0
);

-- Indexes for optimal performance
create index if not exists idx_campaign_records_campaign
  on campaign_records(campaign_id);

create index if not exists idx_campaign_records_send_status
  on campaign_records(send_status);

create index if not exists idx_campaign_records_approval
  on campaign_records(approval_status);

create index if not exists idx_campaign_events_campaign
  on campaign_events(campaign_id);

create index if not exists idx_campaign_events_record
  on campaign_events(record_id);

-- Storage bucket setup instructions:
-- In Supabase Dashboard -> Storage -> Create bucket named "certificate" (or SUPABASE_STORAGE_BUCKET)
