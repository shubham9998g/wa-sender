import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { db } from './lib/db';
import { parseCurl, maskSecret } from './lib/curl-parser';
import { normalizePhoneNumber } from './lib/phone';
import { extractAndStoreZipMedia } from './lib/media';
import { validateAllCampaignRecords, checkCampaignReadiness } from './lib/validation';
import { exportRecordsToCsv } from './lib/export';
import { startWorker } from './worker';
import { Campaign, CampaignRecord } from './src/types';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

async function startApp() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Local storage route for media preview & delivery fallback
  app.get('/api/storage/:campaignId/:filename', (req, res) => {
    const { campaignId, filename } = req.params;
    const safeFilename = path.basename(decodeURIComponent(filename));
    const filePath = path.join(process.cwd(), '.data', 'storage', campaignId, safeFilename);

    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'Media file not found' });
    }
  });

  // Worker status endpoint
  app.get('/api/worker/status', async (req, res) => {
    try {
      const status = await db.getWorkerHeartbeat();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/campaigns - List all campaigns
  app.get('/api/campaigns', async (req, res) => {
    try {
      const campaigns = await db.getCampaigns();
      res.json(campaigns);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaigns - Create campaign with CSV/XLSX and optional media ZIP
  app.post(
    '/api/campaigns',
    upload.fields([
      { name: 'file', maxCount: 1 },
      { name: 'mediaZip', maxCount: 1 }
    ]),
    async (req: any, res: any) => {
      try {
        const name = (req.body.name || 'Untitled Campaign').trim();
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const dataFile = files?.file?.[0];
        const mediaZip = files?.mediaZip?.[0];

        if (!dataFile) {
          return res.status(400).json({ error: 'Contact file (.csv, .xlsx, .xls) is required' });
        }

        const originalFileName = dataFile.originalname;
        const ext = path.extname(originalFileName).toLowerCase();

        let rawRows: Record<string, any>[] = [];

        if (ext === '.csv') {
          const csvText = dataFile.buffer.toString('utf-8');
          const parsed = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false
          });
          rawRows = parsed.data as Record<string, any>[];
        } else if (ext === '.xlsx' || ext === '.xls') {
          const workbook = XLSX.read(dataFile.buffer, { type: 'buffer' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        } else {
          return res.status(400).json({ error: 'Unsupported file type. Please upload .csv, .xlsx, or .xls' });
        }

        if (rawRows.length === 0) {
          return res.status(400).json({ error: 'Spreadsheet contains no records or rows' });
        }

        // Clean headers and rows
        const cleanedRows: Record<string, any>[] = [];
        const detectedHeaders = Object.keys(rawRows[0] || {});

        // Auto-detect likely phone column and name column
        let autoPhoneCol = detectedHeaders.find((h) =>
          /phone|mobile|contact|cell|number|destination|tel/i.test(h)
        );
        let autoNameCol = detectedHeaders.find((h) =>
          /name|customer|client|user/i.test(h)
        );
        let autoFileCol = detectedHeaders.find((h) =>
          /file|pdf|doc|media|cert/i.test(h)
        );

        for (const row of rawRows) {
          const cleanRow: Record<string, any> = {};
          for (const [k, v] of Object.entries(row)) {
            const cleanKey = k.trim();
            cleanRow[cleanKey] = v !== null && v !== undefined ? String(v).trim() : '';
          }
          cleanedRows.push(cleanRow);
        }

        // Create campaign
        const campaign = await db.createCampaign({
          name,
          status: 'draft',
          original_file_name: originalFileName,
          total_records: cleanedRows.length,
          pending_count: cleanedRows.length,
          field_mapping: {
            destination: autoPhoneCol || undefined,
            userName: autoNameCol || undefined,
            media: autoFileCol ? { 'media[0]': autoFileCol } : undefined
          }
        });

        // Insert records
        const recordCandidates: Partial<CampaignRecord>[] = cleanedRows.map((row, idx) => {
          const rawPhone = autoPhoneCol ? row[autoPhoneCol] : '';
          const phoneNorm = normalizePhoneNumber(rawPhone);
          const rawFile = autoFileCol ? row[autoFileCol] : '';

          return {
            campaign_id: campaign.id,
            row_number: idx + 1,
            source_data: row,
            destination: rawPhone || null,
            normalized_destination: phoneNorm.isValid ? phoneNorm.normalized : null,
            approval_status: 'pending',
            validation_status: phoneNorm.isValid ? 'valid' : 'invalid',
            validation_reason: phoneNorm.isValid ? null : phoneNorm.reason,
            media_source: rawFile || null,
            send_status: 'pending',
            attempts: 0
          };
        });

        await db.createRecords(recordCandidates);

        // If media ZIP was uploaded, extract it now
        if (mediaZip) {
          const zipResult = await extractAndStoreZipMedia(campaign.id, mediaZip.buffer);
          await db.logEvent(
            campaign.id,
            'campaign_created',
            `Campaign created with ${cleanedRows.length} records. Extracted ${zipResult.extractedCount} media files.`,
            null
          );
        } else {
          await db.logEvent(
            campaign.id,
            'campaign_created',
            `Campaign created with ${cleanedRows.length} records from ${originalFileName}.`,
            null
          );
        }

        await db.recalculateCampaignCounters(campaign.id);
        const updated = await db.getCampaign(campaign.id);
        res.status(201).json(updated);
      } catch (err: any) {
        console.error('[API] Create campaign failed:', err);
        res.status(500).json({ error: err.message || 'Failed to create campaign' });
      }
    }
  );

  // GET /api/campaigns/:id - Get campaign details & readiness checklist
  app.get('/api/campaigns/:id', async (req, res) => {
    try {
      const campaign = await db.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const records = await db.getAllRecords(campaign.id);
      const media = await db.getMedia(campaign.id);
      const readiness = checkCampaignReadiness(campaign, records, media);

      res.json({
        ...campaign,
        readiness,
        mediaCount: media.length
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/campaigns/:id - Delete campaign
  app.delete('/api/campaigns/:id', async (req, res) => {
    try {
      const deleted = await db.deleteCampaign(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaigns/:id/parse-curl - Parse cURL command
  app.post('/api/campaigns/:id/parse-curl', async (req, res) => {
    try {
      const { curl } = req.body;
      if (!curl || typeof curl !== 'string') {
        return res.status(400).json({ error: 'cURL command string is required' });
      }

      const campaign = await db.getCampaign(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      const parsed = parseCurl(curl);

      // Inspect records to match detected fields to CSV columns
      const records = await db.getAllRecords(campaign.id);
      const sampleRow = records[0]?.source_data || {};
      const csvCols = Object.keys(sampleRow);

      const mapping = { ...campaign.field_mapping };

      // Auto-suggest phone column mapping if detected
      if (!mapping.destination && parsed.detected.destinationField) {
        const match = csvCols.find((c) =>
          /phone|mobile|contact|cell|number|destination|tel/i.test(c)
        );
        if (match) mapping.destination = match;
      }

      // Auto-suggest userName column mapping
      if (!mapping.userName && parsed.detected.userNameField) {
        const match = csvCols.find((c) => /name|customer|client|user/i.test(c));
        if (match) mapping.userName = match;
      }

      // Auto-suggest media mapping
      if (parsed.detected.media.length > 0) {
        mapping.media = mapping.media || {};
        parsed.detected.media.forEach((m, idx) => {
          if (!mapping.media![m.path]) {
            const match = csvCols.find((c) =>
              new RegExp(`file|pdf|doc|cert|media|attachment|img|${idx + 1}`, 'i').test(c)
            );
            if (match) mapping.media![m.path] = match;
          }
        });
      }

      // Update campaign with parsed template and updated mapping
      await db.updateCampaign(campaign.id, {
        parsed_template: parsed,
        field_mapping: mapping
      });

      res.json({
        ok: true,
        parsed,
        field_mapping: mapping
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaigns/:id/mapping - Save field mappings
  app.post('/api/campaigns/:id/mapping', async (req, res) => {
    try {
      const { mapping } = req.body;
      if (!mapping || typeof mapping !== 'object') {
        return res.status(400).json({ error: 'Mapping object is required' });
      }

      const campaign = await db.getCampaign(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      await db.updateCampaign(campaign.id, { field_mapping: mapping });

      // Re-validate records with new mapping
      const records = await db.getAllRecords(campaign.id);
      const media = await db.getMedia(campaign.id);
      const freshCampaign = (await db.getCampaign(campaign.id))!;

      const validationResults = validateAllCampaignRecords(records, freshCampaign, media);

      for (const resItem of validationResults) {
        await db.updateRecord(resItem.recordId, {
          validation_status: resItem.validationStatus,
          validation_reason: resItem.validationReason,
          normalized_destination: resItem.normalizedDestination
        });
      }

      const readiness = checkCampaignReadiness(freshCampaign, records, media);

      // If fully ready and previously draft, transition to ready
      if (readiness.isReady && freshCampaign.status === 'draft') {
        await db.updateCampaign(campaign.id, { status: 'ready' });
      }

      res.json({ ok: true, field_mapping: mapping, readiness });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaigns/:id/upload-media - Upload ZIP or media files
  app.post(
    '/api/campaigns/:id/upload-media',
    upload.fields([{ name: 'mediaZip', maxCount: 1 }]),
    async (req: any, res: any) => {
      try {
        const campaign = await db.getCampaign(req.params.id);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const mediaZip = files?.mediaZip?.[0];

        if (!mediaZip) {
          return res.status(400).json({ error: 'Please select a .zip media file to upload' });
        }

        const result = await extractAndStoreZipMedia(campaign.id, mediaZip.buffer);

        await db.logEvent(
          campaign.id,
          'media_missing',
          `Extracted ${result.extractedCount} media files from ZIP. ${result.errors.length > 0 ? `Warnings: ${result.errors.join('; ')}` : ''}`,
          null,
          result
        );

        // Re-validate records
        const records = await db.getAllRecords(campaign.id);
        const media = await db.getMedia(campaign.id);
        const validationResults = validateAllCampaignRecords(records, campaign, media);

        for (const resItem of validationResults) {
          await db.updateRecord(resItem.recordId, {
            validation_status: resItem.validationStatus,
            validation_reason: resItem.validationReason
          });
        }

        res.json({ ok: true, extractedCount: result.extractedCount, files: result.files, errors: result.errors });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // POST /api/campaigns/:id/validate - Run full validation
  app.post('/api/campaigns/:id/validate', async (req, res) => {
    try {
      const campaign = await db.getCampaign(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      const records = await db.getAllRecords(campaign.id);
      const media = await db.getMedia(campaign.id);

      const validationResults = validateAllCampaignRecords(records, campaign, media);

      for (const item of validationResults) {
        await db.updateRecord(item.recordId, {
          validation_status: item.validationStatus,
          validation_reason: item.validationReason,
          normalized_destination: item.normalizedDestination
        });
      }

      const updatedRecords = await db.getAllRecords(campaign.id);
      const readiness = checkCampaignReadiness(campaign, updatedRecords, media);

      if (readiness.isReady && campaign.status === 'draft') {
        await db.updateCampaign(campaign.id, { status: 'ready' });
      }

      res.json({
        ok: true,
        readiness,
        validCount: validationResults.filter((r) => r.validationStatus === 'valid').length,
        invalidCount: validationResults.filter((r) => r.validationStatus === 'invalid').length,
        warningCount: validationResults.filter((r) => r.validationStatus === 'warning').length
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaigns/:id/approve - Approve / Reject specific records
  app.post('/api/campaigns/:id/approve', async (req, res) => {
    try {
      const { recordIds, status } = req.body;
      if (!Array.isArray(recordIds) || !['approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'Invalid recordIds array or status' });
      }

      await db.bulkUpdateApproval(req.params.id, recordIds, status);
      await db.logEvent(
        req.params.id,
        'approval_changed',
        `Updated approval status to "${status}" for ${recordIds.length} record(s).`,
        null
      );

      const updated = await db.getCampaign(req.params.id);
      res.json({ ok: true, campaign: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaigns/:id/approve-all - Bulk approve all valid or reject all
  app.post('/api/campaigns/:id/approve-all', async (req, res) => {
    try {
      const { target } = req.body; // 'all_valid' | 'all_rejected'
      const campaign = await db.getCampaign(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      if (target === 'all_valid') {
        await db.bulkUpdateApproval(campaign.id, 'all_valid', 'approved');
        await db.logEvent(
          campaign.id,
          'approval_changed',
          'Approved all valid records.',
          null
        );
      } else if (target === 'all_rejected') {
        await db.bulkUpdateApproval(campaign.id, 'all_rejected', 'rejected');
        await db.logEvent(
          campaign.id,
          'approval_changed',
          'Rejected all records.',
          null
        );
      }

      const updated = await db.getCampaign(campaign.id);
      res.json({ ok: true, campaign: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaigns/:id/start - Start campaign sending
  // CRITICAL:
  // 1. Verify campaign exists
  // 2. Verify campaign is ready
  // 3. Verify at least one approved record exists
  // 4. Verify required mappings
  // 5. Verify required media
  // 6. Set status = 'sending'
  // 7. Create campaign_started event
  // MUST NOT perform actual sending loop itself! Worker processes it.
  app.post('/api/campaigns/:id/start', async (req, res) => {
    try {
      const campaign = await db.getCampaign(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      const records = await db.getAllRecords(campaign.id);
      const media = await db.getMedia(campaign.id);
      const readiness = checkCampaignReadiness(campaign, records, media);

      if (!readiness.isReady) {
        return res.status(400).json({
          error: `Cannot start campaign: ${readiness.blockers.join('; ')}`,
          readiness
        });
      }

      const approvedPendingCount = records.filter(
        (r) => r.approval_status === 'approved' && r.send_status === 'pending'
      ).length;

      if (approvedPendingCount === 0) {
        return res.status(400).json({
          error: 'No approved pending records available to send.'
        });
      }

      await db.updateCampaign(campaign.id, { status: 'sending' });

      // CRITICAL: record_id MUST be null for campaign-level event!
      await db.logEvent(
        campaign.id,
        'campaign_started',
        `Campaign started. Scheduled ${approvedPendingCount} approved message(s) for delivery.`,
        null
      );

      res.json({ ok: true, status: 'sending', count: approvedPendingCount });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaigns/:id/pause - Pause campaign sending
  app.post('/api/campaigns/:id/pause', async (req, res) => {
    try {
      const campaign = await db.getCampaign(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      await db.updateCampaign(campaign.id, { status: 'paused' });
      await db.logEvent(campaign.id, 'paused', 'Campaign paused by user.', null);
      res.json({ ok: true, status: 'paused' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaigns/:id/resume - Resume campaign sending
  app.post('/api/campaigns/:id/resume', async (req, res) => {
    try {
      const campaign = await db.getCampaign(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      await db.updateCampaign(campaign.id, { status: 'sending' });
      await db.logEvent(campaign.id, 'resumed', 'Campaign resumed by user.', null);
      res.json({ ok: true, status: 'sending' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaigns/:id/stop - Stop campaign sending
  app.post('/api/campaigns/:id/stop', async (req, res) => {
    try {
      const campaign = await db.getCampaign(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      await db.updateCampaign(campaign.id, { status: 'stopped' });
      await db.logEvent(campaign.id, 'stopped', 'Campaign stopped by user.', null);
      res.json({ ok: true, status: 'stopped' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaigns/:id/retry - Retry all failed records
  app.post('/api/campaigns/:id/retry', async (req, res) => {
    try {
      const campaign = await db.getCampaign(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      const count = await db.resetFailedRecords(campaign.id);
      await db.logEvent(
        campaign.id,
        'retry',
        `Reset ${count} failed record(s) back to pending for retry.`,
        null
      );

      res.json({ ok: true, count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaigns/:id/retry-selected - Retry specific failed records
  app.post('/api/campaigns/:id/retry-selected', async (req, res) => {
    try {
      const { recordIds } = req.body;
      if (!Array.isArray(recordIds) || recordIds.length === 0) {
        return res.status(400).json({ error: 'recordIds array is required' });
      }

      const count = await db.resetFailedRecords(req.params.id, recordIds);
      await db.logEvent(
        req.params.id,
        'retry',
        `Reset ${count} selected failed record(s) back to pending for retry.`,
        null
      );

      res.json({ ok: true, count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/campaigns/:id/records - Get paginated records with search & filters
  app.get('/api/campaigns/:id/records', async (req, res) => {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '50', 10);
      const search = (req.query.search as string) || '';
      const sendStatus = (req.query.sendStatus as string) || 'all';
      const approvalStatus = (req.query.approvalStatus as string) || 'all';
      const validationStatus = (req.query.validationStatus as string) || 'all';

      const result = await db.getRecords(req.params.id, {
        page,
        limit,
        search,
        sendStatus,
        approvalStatus,
        validationStatus
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/campaigns/:id/records/:recordId - Edit record (e.g. fix failed phone)
  app.patch('/api/campaigns/:id/records/:recordId', async (req, res) => {
    try {
      const { phone, mediaSource, sourceData, approvalStatus } = req.body;
      const record = await db.getRecord(req.params.recordId);
      if (!record) return res.status(404).json({ error: 'Record not found' });

      const updates: Partial<CampaignRecord> = {};

      if (phone !== undefined) {
        const phoneNorm = normalizePhoneNumber(phone);
        updates.destination = phone;
        updates.normalized_destination = phoneNorm.isValid ? phoneNorm.normalized : null;
        updates.validation_status = phoneNorm.isValid ? 'valid' : 'invalid';
        updates.validation_reason = phoneNorm.isValid ? null : phoneNorm.reason;
      }

      if (mediaSource !== undefined) {
        updates.media_source = mediaSource;
      }

      if (sourceData !== undefined) {
        updates.source_data = { ...record.source_data, ...sourceData };
      }

      if (approvalStatus !== undefined) {
        updates.approval_status = approvalStatus;
      }

      const updated = await db.updateRecord(record.id, updates);
      await db.recalculateCampaignCounters(req.params.id);

      res.json({ ok: true, record: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/campaigns/:id/logs - Get events
  app.get('/api/campaigns/:id/logs', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string || '100', 10);
      const events = await db.getEvents(req.params.id, limit);
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/campaigns/:id/export - Export records as CSV
  app.get('/api/campaigns/:id/export', async (req, res) => {
    try {
      const campaign = await db.getCampaign(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      const records = await db.getAllRecords(campaign.id);
      const csv = exportRecordsToCsv(records);

      const safeName = campaign.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}_export.csv"`);
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware setup for React frontend
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Start background worker loop automatically in server process so it is live in preview!
  startWorker().catch((err) => {
    console.error('[WORKER BACKGROUND] Error in server background worker:', err);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startApp().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
