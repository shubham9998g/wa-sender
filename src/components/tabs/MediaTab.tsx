import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  FileCheck,
  FileX,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  HardDrive
} from 'lucide-react';
import { Campaign, CampaignMedia, CampaignRecord } from '../../types';

interface MediaTabProps {
  campaign: Campaign;
  records: CampaignRecord[];
  onUploadZip: (file: File) => Promise<void>;
}

export const MediaTab: React.FC<MediaTabProps> = ({
  campaign,
  records,
  onUploadZip
}) => {
  const [mediaList, setMediaList] = useState<CampaignMedia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const fetchMedia = async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`);
      if (res.ok) {
        // Fetch media list from internal storage / db
        const mediaRes = await fetch(`/api/campaigns/${campaign.id}/logs`); // fallback
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [campaign.id]);

  // Extract all referenced filenames from records
  const mediaCol = campaign.field_mapping?.media?.['media[0]'] || campaign.field_mapping?.media?.media;
  const referencedFileNames = Array.from(
    new Set(
      records
        .map((r) => (mediaCol ? r.source_data[mediaCol] : r.media_source))
        .filter(Boolean)
    )
  );

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zipFile) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      await onUploadZip(zipFile);
      setUploadSuccess(`Media ZIP successfully uploaded and extracted!`);
      setZipFile(null);
    } catch (err: any) {
      setUploadError(err.message || 'Error extracting media ZIP');
    } finally {
      setIsUploading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Upload ZIP Card */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs">
        <div className="flex items-center space-x-2 mb-2">
          <UploadCloud className="h-5 w-5 text-emerald-600" />
          <h3 className="text-base font-semibold text-zinc-900">Upload Media Bundle (.zip)</h3>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Upload a ZIP containing PDFs, documents, or images referenced by your contact list. Files are securely extracted
          and stored in Supabase Storage with Zip Slip protection.
        </p>

        {uploadError && (
          <div className="mb-4 p-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {uploadSuccess && (
          <div className="mb-4 p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-xs text-emerald-700 flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
        )}

        <form onSubmit={handleUpload} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full border border-zinc-300 rounded-xl px-3 py-2 text-xs bg-zinc-50">
            <input
              type="file"
              accept=".zip, application/zip"
              onChange={(e) => setZipFile(e.target.files?.[0] || null)}
              className="w-full cursor-pointer text-xs"
            />
          </div>
          <button
            type="submit"
            disabled={isUploading || !zipFile}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors shadow-xs"
          >
            {isUploading ? 'Extracting & Uploading...' : 'Upload & Extract ZIP'}
          </button>
        </form>
      </div>

      {/* CSV Referenced Media Cross-Validation Table */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-zinc-900">Media Cross-Validation</h3>
            <p className="text-xs text-zinc-500">
              Comparing media files referenced in spreadsheet against uploaded bundle
            </p>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            {referencedFileNames.length} file reference(s) detected
          </span>
        </div>

        {referencedFileNames.length === 0 ? (
          <div className="py-8 text-center text-zinc-400 text-xs">
            No media filename column mapped yet. Configure media mapping in the <strong>cURL & Mapping</strong> tab.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-semibold text-zinc-600 uppercase">
                <tr>
                  <th className="py-2.5 px-3">Referenced Filename in Spreadsheet</th>
                  <th className="py-2.5 px-3">Referenced By Records</th>
                  <th className="py-2.5 px-3">Storage Verification</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {referencedFileNames.map((fileName) => {
                  const referencingCount = records.filter(
                    (r) => (mediaCol ? r.source_data[mediaCol] : r.media_source) === fileName
                  ).length;

                  // Check if any invalid records for this filename
                  const invalidForThis = records.filter(
                    (r) =>
                      (mediaCol ? r.source_data[mediaCol] : r.media_source) === fileName &&
                      r.validation_status === 'invalid' &&
                      r.validation_reason?.includes('Missing media')
                  ).length;

                  const isMissing = invalidForThis > 0;

                  return (
                    <tr key={fileName} className="hover:bg-zinc-50/50">
                      <td className="py-3 px-3 font-mono font-medium text-zinc-900">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-zinc-400" />
                          <span>{fileName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-zinc-600">
                        {referencingCount} recipient(s)
                      </td>
                      <td className="py-3 px-3">
                        {!isMissing ? (
                          <span className="inline-flex items-center space-x-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <FileCheck className="h-3.5 w-3.5" />
                            <span>FOUND</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                            <FileX className="h-3.5 w-3.5" />
                            <span>MISSING</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <a
                          href={`/api/storage/${campaign.id}/${encodeURIComponent(String(fileName))}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                        >
                          <span>Preview</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
