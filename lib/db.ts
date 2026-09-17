import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Campaign,
  CampaignRecord,
  CampaignMedia,
  CampaignEvent,
  WorkerHeartbeat,
  CampaignStatus,
  ApprovalStatus,
  EventType,
  RecordSendStatus
} from '../src/types';

// Load Supabase environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'certificate';

let supabaseClient: SupabaseClient | null = null;
const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_KEY &&
  !SUPABASE_URL.includes('your-project') &&
  !SUPABASE_KEY.includes('your-')
);

if (isSupabaseConfigured) {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
    console.log('[DB] Connected to Supabase at:', SUPABASE_URL);
  } catch (err) {
    console.warn('[DB] Failed to initialize Supabase client, falling back to local store:', err);
    supabaseClient = null;
  }
} else {
  console.log('[DB] Supabase credentials not set or placeholder. Using robust local persistent store.');
}

// Local Persistent Store Directory
const DATA_DIR = path.join(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const STORAGE_DIR = path.join(DATA_DIR, 'storage');

interface LocalDbSchema {
  campaigns: Record<string, Campaign>;
  records: Record<string, CampaignRecord>;
  media: Record<string, CampaignMedia>;
  events: CampaignEvent[];
  worker: WorkerHeartbeat;
}

function ensureDataDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const initial: LocalDbSchema = {
      campaigns: {},
      records: {},
      media: {},
      events: [],
      worker: {
        id: 'primary',
        last_seen: new Date().toISOString(),
        hostname: 'localhost',
        active_campaigns: 0
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

function readLocalDb(): LocalDbSchema {
  ensureDataDirs();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    const fallback: LocalDbSchema = {
      campaigns: {},
      records: {},
      media: {},
      events: [],
      worker: {
        id: 'primary',
        last_seen: new Date().toISOString(),
        hostname: 'localhost',
        active_campaigns: 0
      }
    };
    return fallback;
  }
}

function writeLocalDb(data: LocalDbSchema) {
  ensureDataDirs();
  const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

export const db = {
  isSupabaseConfigured() {
    return isSupabaseConfigured && Boolean(supabaseClient);
  },

  getSupabaseClient(): SupabaseClient | null {
    return supabaseClient;
  },

  async getCampaigns(): Promise<Campaign[]> {
    if (isSupabaseConfigured && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        return data.map((d: any) => ({
          ...d,
          original_file_name: d.source_file_name || d.original_file_name,
          send_delay_ms: d.send_delay_ms ?? 1000,
          max_attempts: d.max_attempts ?? 3
        })) as Campaign[];
      }
    }

    const local = readLocalDb();
    return Object.values(local.campaigns).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async getCampaign(id: string): Promise<Campaign | null> {
    if (isSupabaseConfigured && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) {
        return {
          ...data,
          original_file_name: data.source_file_name || data.original_file_name,
          send_delay_ms: data.send_delay_ms ?? 1000,
          max_attempts: data.max_attempts ?? 3
        } as Campaign;
      }
    }

    const local = readLocalDb();
    return local.campaigns[id] || null;
  },

  async createCampaign(campaignData: Partial<Campaign>): Promise<Campaign> {
    const now = new Date().toISOString();
    const id = campaignData.id || crypto.randomUUID();

    const campaign: Campaign = {
      id,
      name: campaignData.name || 'Untitled Campaign',
      status: campaignData.status || 'draft',
      original_file_name: campaignData.original_file_name || null,
      parsed_template: campaignData.parsed_template || null,
      field_mapping: campaignData.field_mapping || {},
      total_records: campaignData.total_records || 0,
      approved_records: campaignData.approved_records || 0,
      sent_count: campaignData.sent_count || 0,
      failed_count: campaignData.failed_count || 0,
      pending_count: campaignData.pending_count || 0,
      send_delay_ms: campaignData.send_delay_ms ?? 1000,
      max_attempts: campaignData.max_attempts ?? 3,
      created_at: campaignData.created_at || now,
      updated_at: campaignData.updated_at || now
    };

    if (isSupabaseConfigured && supabaseClient) {
      const { original_file_name, send_delay_ms, max_attempts, ...rest } = campaign;
      const dbPayload = {
        ...rest,
        source_file_name: original_file_name
      };
      const { data, error } = await supabaseClient
        .from('campaigns')
        .insert([dbPayload])
        .select()
        .single();
      
      if (!error && data) {
        return {
          ...data,
          original_file_name: data.source_file_name || data.original_file_name,
          send_delay_ms: data.send_delay_ms ?? 1000,
          max_attempts: data.max_attempts ?? 3
        } as Campaign;
      }
      console.warn('[DB] Supabase insert campaign error:', error);
    }

    const local = readLocalDb();
    local.campaigns[id] = campaign;
    writeLocalDb(local);
    return campaign;
  },

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | null> {
    const now = new Date().toISOString();
    const updatedFields = { ...updates, updated_at: now };

    if (isSupabaseConfigured && supabaseClient) {
      const { original_file_name, send_delay_ms, max_attempts, ...rest } = updatedFields as any;
      const dbPayload = { ...rest };
      if (original_file_name !== undefined) {
        dbPayload.source_file_name = original_file_name;
      }
      
      const { data, error } = await supabaseClient
        .from('campaigns')
        .update(dbPayload)
        .eq('id', id)
        .select()
        .single();
      
      if (!error && data) {
        return {
          ...data,
          original_file_name: data.source_file_name || data.original_file_name,
          send_delay_ms: data.send_delay_ms ?? 1000,
          max_attempts: data.max_attempts ?? 3
        } as Campaign;
      }
    }

    const local = readLocalDb();
    if (!local.campaigns[id]) return null;
    local.campaigns[id] = { ...local.campaigns[id], ...updatedFields };
    writeLocalDb(local);
    return local.campaigns[id];
  },

  async deleteCampaign(id: string): Promise<boolean> {
    if (isSupabaseConfigured && supabaseClient) {
      const { error } = await supabaseClient.from('campaigns').delete().eq('id', id);
      if (!error) return true;
    }

    const local = readLocalDb();
    delete local.campaigns[id];
    for (const [rId, r] of Object.entries(local.records)) {
      if (r.campaign_id === id) delete local.records[rId];
    }
    for (const [mId, m] of Object.entries(local.media)) {
      if (m.campaign_id === id) delete local.media[mId];
    }
    local.events = local.events.filter((e) => e.campaign_id !== id);
    writeLocalDb(local);
    return true;
  },

  async recalculateCampaignCounters(campaignId: string): Promise<void> {
    const records = await this.getAllRecords(campaignId);
    const total = records.length;
    const approved = records.filter((r) => r.approval_status === 'approved').length;
    const sent = records.filter((r) => r.send_status === 'sent').length;
    const failed = records.filter((r) => r.send_status === 'failed').length;
    const pending = records.filter((r) => r.send_status === 'pending').length;

    await this.updateCampaign(campaignId, {
      total_records: total,
      approved_records: approved,
      sent_count: sent,
      failed_count: failed,
      pending_count: pending
    });
  },

  async getRecords(
    campaignId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      sendStatus?: string;
      approvalStatus?: string;
      validationStatus?: string;
    } = {}
  ): Promise<{ records: CampaignRecord[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    if (isSupabaseConfigured && supabaseClient) {
      let query = supabaseClient
        .from('campaign_records')
        .select('*', { count: 'exact' })
        .eq('campaign_id', campaignId);

      if (options.sendStatus && options.sendStatus !== 'all') {
        query = query.eq('send_status', options.sendStatus);
      }
      if (options.approvalStatus && options.approvalStatus !== 'all') {
        query = query.eq('approval_status', options.approvalStatus);
      }
      if (options.validationStatus && options.validationStatus !== 'all') {
        query = query.eq('validation_status', options.validationStatus);
      }
      if (options.search) {
        query = query.or(
          `destination.ilike.%${options.search}%,normalized_destination.ilike.%${options.search}%`
        );
      }

      const { data, count, error } = await query
        .order('row_number', { ascending: true })
        .range(offset, offset + limit - 1);

      if (!error && data) {
        return { records: data as CampaignRecord[], total: count || 0 };
      }
    }

    const local = readLocalDb();
    let list = Object.values(local.records).filter((r) => r.campaign_id === campaignId);

    if (options.sendStatus && options.sendStatus !== 'all') {
      list = list.filter((r) => r.send_status === options.sendStatus);
    }
    if (options.approvalStatus && options.approvalStatus !== 'all') {
      list = list.filter((r) => r.approval_status === options.approvalStatus);
    }
    if (options.validationStatus && options.validationStatus !== 'all') {
      list = list.filter((r) => r.validation_status === options.validationStatus);
    }
    if (options.search) {
      const q = options.search.toLowerCase();
      list = list.filter((r) => {
        const dest = (r.destination || '').toLowerCase();
        const norm = (r.normalized_destination || '').toLowerCase();
        const sourceStr = JSON.stringify(r.source_data).toLowerCase();
        return dest.includes(q) || norm.includes(q) || sourceStr.includes(q);
      });
    }

    list.sort((a, b) => a.row_number - b.row_number);
    const total = list.length;
    const paginated = list.slice(offset, offset + limit);
    return { records: paginated, total };
  },

  async getAllRecords(campaignId: string): Promise<CampaignRecord[]> {
    if (isSupabaseConfigured && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('campaign_records')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('row_number', { ascending: true });
      if (!error && data) return data as CampaignRecord[];
    }

    const local = readLocalDb();
    return Object.values(local.records)
      .filter((r) => r.campaign_id === campaignId)
      .sort((a, b) => a.row_number - b.row_number);
  },

  async getRecord(recordId: string): Promise<CampaignRecord | null> {
    if (isSupabaseConfigured && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('campaign_records')
        .select('*')
        .eq('id', recordId)
        .single();
      if (!error && data) return data as CampaignRecord;
    }

    const local = readLocalDb();
    return local.records[recordId] || null;
  },

  async createRecords(records: Partial<CampaignRecord>[]): Promise<CampaignRecord[]> {
    const now = new Date().toISOString();
    const created: CampaignRecord[] = records.map((r, i) => ({
      id: r.id || crypto.randomUUID(),
      campaign_id: r.campaign_id!,
      row_number: r.row_number ?? i + 1,
      source_data: r.source_data || {},
      destination: r.destination || null,
      normalized_destination: r.normalized_destination || null,
      approval_status: r.approval_status || 'pending',
      validation_status: r.validation_status || 'pending',
      validation_reason: r.validation_reason || null,
      media_source: r.media_source || null,
      media_storage_path: r.media_storage_path || null,
      media_url: r.media_url || null,
      send_status: r.send_status || 'pending',
      attempts: r.attempts || 0,
      queued_at: r.queued_at || null,
      sent_at: r.sent_at || null,
      message_id: r.message_id || null,
      provider_status: r.provider_status || null,
      provider_response: r.provider_response || null,
      fail_reason: r.fail_reason || null,
      created_at: r.created_at || now,
      updated_at: r.updated_at || now
    }));

    if (isSupabaseConfigured && supabaseClient) {
      // Chunk inserts in batches of 200
      for (let i = 0; i < created.length; i += 200) {
        const chunk = created.slice(i, i + 200);
        const { error } = await supabaseClient.from('campaign_records').insert(chunk);
        if (error) console.warn('[DB] Supabase batch insert records error:', error);
      }
      return created;
    }

    const local = readLocalDb();
    for (const r of created) {
      local.records[r.id] = r;
    }
    writeLocalDb(local);
    return created;
  },

  async updateRecord(recordId: string, updates: Partial<CampaignRecord>): Promise<CampaignRecord | null> {
    const now = new Date().toISOString();
    const fields = { ...updates, updated_at: now };

    if (isSupabaseConfigured && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('campaign_records')
        .update(fields)
        .eq('id', recordId)
        .select()
        .single();
      if (!error && data) return data as CampaignRecord;
    }

    const local = readLocalDb();
    if (!local.records[recordId]) return null;
    local.records[recordId] = { ...local.records[recordId], ...fields };
    writeLocalDb(local);
    return local.records[recordId];
  },

  async bulkUpdateApproval(
    campaignId: string,
    target: 'all_valid' | 'all_rejected' | string[],
    approvalStatus: ApprovalStatus
  ): Promise<number> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured && supabaseClient) {
      let query = supabaseClient.from('campaign_records').update({
        approval_status: approvalStatus,
        updated_at: now
      });

      if (target === 'all_valid') {
        query = query.eq('campaign_id', campaignId).eq('validation_status', 'valid');
      } else if (target === 'all_rejected') {
        query = query.eq('campaign_id', campaignId);
      } else if (Array.isArray(target)) {
        query = query.in('id', target);
      }

      const { error } = await query;
      if (!error) {
        await this.recalculateCampaignCounters(campaignId);
        return 1;
      }
    }

    const local = readLocalDb();
    let updatedCount = 0;

    for (const r of Object.values(local.records)) {
      if (r.campaign_id !== campaignId) continue;
      if (target === 'all_valid' && r.validation_status === 'valid') {
        r.approval_status = approvalStatus;
        r.updated_at = now;
        updatedCount++;
      } else if (target === 'all_rejected') {
        r.approval_status = approvalStatus;
        r.updated_at = now;
        updatedCount++;
      } else if (Array.isArray(target) && target.includes(r.id)) {
        r.approval_status = approvalStatus;
        r.updated_at = now;
        updatedCount++;
      }
    }

    writeLocalDb(local);
    await this.recalculateCampaignCounters(campaignId);
    return updatedCount;
  },

  /**
   * Atomically claims the next pending approved record for sending.
   * Prevents duplicate sending across concurrent workers.
   */
  async claimNextPendingRecord(campaignId: string): Promise<CampaignRecord | null> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured && supabaseClient) {
      // Find one candidate
      const { data: candidates } = await supabaseClient
        .from('campaign_records')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('approval_status', 'approved')
        .eq('send_status', 'pending')
        .order('row_number', { ascending: true })
        .limit(1);

      if (candidates && candidates.length > 0) {
        const candidate = candidates[0];
        // Conditional update
        const { data: updated, error } = await supabaseClient
          .from('campaign_records')
          .update({
            send_status: 'sending',
            queued_at: now,
            updated_at: now
          })
          .eq('id', candidate.id)
          .eq('send_status', 'pending')
          .select()
          .single();

        if (!error && updated) {
          return updated as CampaignRecord;
        }
      }
      return null;
    }

    const local = readLocalDb();
    const candidate = Object.values(local.records)
      .filter(
        (r) =>
          r.campaign_id === campaignId &&
          r.approval_status === 'approved' &&
          r.send_status === 'pending'
      )
      .sort((a, b) => a.row_number - b.row_number)[0];

    if (!candidate) return null;

    candidate.send_status = 'sending';
    candidate.queued_at = now;
    candidate.updated_at = now;
    writeLocalDb(local);
    return candidate;
  },

  async resetFailedRecords(campaignId: string, recordIds?: string[]): Promise<number> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured && supabaseClient) {
      let query = supabaseClient
        .from('campaign_records')
        .update({
          send_status: 'pending',
          attempts: 0,
          fail_reason: null,
          provider_status: null,
          provider_response: null,
          updated_at: now
        })
        .eq('campaign_id', campaignId)
        .eq('send_status', 'failed');

      if (recordIds && recordIds.length > 0) {
        query = query.in('id', recordIds);
      }

      await query;
      await this.recalculateCampaignCounters(campaignId);
      return 1;
    }

    const local = readLocalDb();
    let count = 0;
    for (const r of Object.values(local.records)) {
      if (r.campaign_id === campaignId && r.send_status === 'failed') {
        if (!recordIds || recordIds.includes(r.id)) {
          r.send_status = 'pending';
          r.attempts = 0;
          r.fail_reason = null;
          r.provider_status = null;
          r.provider_response = null;
          r.updated_at = now;
          count++;
        }
      }
    }
    writeLocalDb(local);
    await this.recalculateCampaignCounters(campaignId);
    return count;
  },

  async getMedia(campaignId: string): Promise<CampaignMedia[]> {
    if (isSupabaseConfigured && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('campaign_media')
        .select('*')
        .eq('campaign_id', campaignId);
      if (!error && data) return data as CampaignMedia[];
    }

    const local = readLocalDb();
    return Object.values(local.media).filter((m) => m.campaign_id === campaignId);
  },

  async addMedia(mediaData: Partial<CampaignMedia>): Promise<CampaignMedia> {
    const now = new Date().toISOString();
    const id = mediaData.id || crypto.randomUUID();
    const item: CampaignMedia = {
      id,
      campaign_id: mediaData.campaign_id!,
      original_name: mediaData.original_name!,
      storage_path: mediaData.storage_path!,
      mime_type: mediaData.mime_type || null,
      file_size: mediaData.file_size || 0,
      checksum: mediaData.checksum || null,
      created_at: mediaData.created_at || now
    };

    if (isSupabaseConfigured && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('campaign_media')
        .upsert(item, { onConflict: 'campaign_id,original_name' })
        .select()
        .single();
      if (!error && data) return data as CampaignMedia;
    }

    const local = readLocalDb();
    local.media[id] = item;
    writeLocalDb(local);
    return item;
  },

  /**
   * Logs campaign events.
   * NOTE: recordId MUST be null for campaign-level events to prevent foreign-key errors!
   */
  async logEvent(
    campaignId: string,
    eventType: EventType,
    message: string,
    recordId: string | null = null,
    data: any = null
  ): Promise<CampaignEvent> {
    const event: CampaignEvent = {
      id: crypto.randomUUID(),
      campaign_id: campaignId,
      record_id: recordId || null,
      event_type: eventType,
      message,
      data: data || null,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabaseClient) {
      await supabaseClient.from('campaign_events').insert([event]);
      return event;
    }

    const local = readLocalDb();
    local.events.unshift(event);
    // Keep last 1000 events
    if (local.events.length > 1000) {
      local.events = local.events.slice(0, 1000);
    }
    writeLocalDb(local);
    return event;
  },

  async getEvents(campaignId: string, limit: number = 100): Promise<CampaignEvent[]> {
    if (isSupabaseConfigured && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('campaign_events')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!error && data) return data as CampaignEvent[];
    }

    const local = readLocalDb();
    return local.events
      .filter((e) => e.campaign_id === campaignId)
      .slice(0, limit);
  },

  async updateWorkerHeartbeat(hostname: string = 'worker-node', activeCampaigns: number = 0): Promise<WorkerHeartbeat> {
    const heartbeat: WorkerHeartbeat = {
      id: 'primary',
      last_seen: new Date().toISOString(),
      hostname,
      active_campaigns: activeCampaigns
    };

    if (isSupabaseConfigured && supabaseClient) {
      await supabaseClient
        .from('worker_heartbeat')
        .upsert(heartbeat, { onConflict: 'id' });
    }

    const local = readLocalDb();
    local.worker = heartbeat;
    writeLocalDb(local);
    return heartbeat;
  },

  async getWorkerHeartbeat(): Promise<WorkerHeartbeat & { online: boolean }> {
    let hb: WorkerHeartbeat = {
      id: 'primary',
      last_seen: new Date(0).toISOString()
    };

    if (isSupabaseConfigured && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('worker_heartbeat')
        .select('*')
        .eq('id', 'primary')
        .single();
      if (data) {
        hb = data as WorkerHeartbeat;
      } else {
        const local = readLocalDb();
        if (local.worker) hb = local.worker;
      }
    } else {
      const local = readLocalDb();
      if (local.worker) hb = local.worker;
    }

    const lastSeenTime = new Date(hb.last_seen).getTime();
    const diffSeconds = (Date.now() - lastSeenTime) / 1000;
    // Worker is considered online if heartbeat was within last 10 seconds
    const online = diffSeconds <= 10;

    return { ...hb, online };
  },

  /**
   * Media file storage:
   * Uploads to Supabase Storage if configured; otherwise stores locally under .data/storage
   */
  async uploadMedia(
    campaignId: string,
    filename: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<{ storagePath: string; url: string }> {
    const cleanFilename = path.basename(filename);
    const storagePath = `campaigns/${campaignId}/media/${cleanFilename}`;

    if (isSupabaseConfigured && supabaseClient) {
      try {
        const { error } = await supabaseClient.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, buffer, {
            contentType: mimeType,
            upsert: true
          });

        if (!error) {
          // Generate signed URL valid for 24 hours (86400s)
          const { data: signedData } = await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(storagePath, 86400);

          return {
            storagePath,
            url: signedData?.signedUrl || ''
          };
        }
        console.warn('[Storage] Supabase upload failed, fallback to local storage:', error);
      } catch (err) {
        console.warn('[Storage] Supabase storage exception:', err);
      }
    }

    // Local file storage
    const campaignMediaDir = path.join(STORAGE_DIR, campaignId);
    if (!fs.existsSync(campaignMediaDir)) {
      fs.mkdirSync(campaignMediaDir, { recursive: true });
    }
    const localFilePath = path.join(campaignMediaDir, cleanFilename);
    fs.writeFileSync(localFilePath, buffer);

    // Return relative public serving URL
    const url = `/api/storage/${campaignId}/${encodeURIComponent(cleanFilename)}`;
    return { storagePath, url };
  },

  async getMediaUrl(campaignId: string, filename: string): Promise<string> {
    const cleanFilename = path.basename(filename);
    const storagePath = `campaigns/${campaignId}/media/${cleanFilename}`;

    if (isSupabaseConfigured && supabaseClient) {
      const { data } = await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 86400);
      if (data?.signedUrl) return data.signedUrl;
    }

    return `/api/storage/${campaignId}/${encodeURIComponent(cleanFilename)}`;
  }
};
