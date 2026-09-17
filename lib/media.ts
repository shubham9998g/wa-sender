import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import { db } from './db';
import { CampaignMedia } from '../src/types';

// Allowed media file extensions
const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.mp4',
  '.mov'
]);

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime'
};

/**
 * Extracts a ZIP archive safely into memory and uploads each valid file to Storage.
 * Protects against Zip Slip (directory traversal) vulnerabilities.
 */
export async function extractAndStoreZipMedia(
  campaignId: string,
  zipBuffer: Buffer
): Promise<{ extractedCount: number; files: CampaignMedia[]; errors: string[] }> {
  const zip = new AdmZip(zipBuffer);
  const zipEntries = zip.getEntries();
  const extractedFiles: CampaignMedia[] = [];
  const errors: string[] = [];

  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;

    const entryName = entry.entryName;

    // Security check: Protect against Zip Slip
    if (entryName.includes('..') || entryName.startsWith('/') || entryName.startsWith('\\')) {
      errors.push(`Rejected unsafe file path in ZIP: "${entryName}" (Zip Slip attempt detected)`);
      continue;
    }

    const baseName = path.basename(entryName);
    // Ignore OS hidden files like __MACOSX, .DS_Store
    if (baseName.startsWith('.') || entryName.includes('__MACOSX')) {
      continue;
    }

    const ext = path.extname(baseName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      errors.push(`Skipped unsupported file type: "${baseName}" (${ext})`);
      continue;
    }

    const fileBuffer = entry.getData();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    try {
      const { storagePath, url } = await db.uploadMedia(
        campaignId,
        baseName,
        fileBuffer,
        mimeType
      );

      const mediaRecord = await db.addMedia({
        campaign_id: campaignId,
        original_name: baseName,
        storage_path: storagePath,
        mime_type: mimeType,
        file_size: fileBuffer.length,
        checksum
      });

      extractedFiles.push({
        ...mediaRecord,
        url
      });
    } catch (err: any) {
      errors.push(`Failed to store "${baseName}": ${err.message || 'Storage error'}`);
    }
  }

  return {
    extractedCount: extractedFiles.length,
    files: extractedFiles,
    errors
  };
}

/**
 * Validates whether media filenames referenced in records exist in uploaded media.
 */
export function validateRecordMedia(
  referencedFilename: string | null | undefined,
  availableMediaMap: Map<string, CampaignMedia>
): { exists: boolean; mediaItem?: CampaignMedia; reason?: string } {
  if (!referencedFilename) {
    return { exists: true }; // No media required for this record
  }

  const cleanName = path.basename(referencedFilename.trim());
  const found = availableMediaMap.get(cleanName) || availableMediaMap.get(cleanName.toLowerCase());

  if (found) {
    return { exists: true, mediaItem: found };
  }

  return {
    exists: false,
    reason: `Missing media file: "${cleanName}" was not found in uploaded media ZIP`
  };
}
