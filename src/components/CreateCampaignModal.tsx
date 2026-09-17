import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, Archive, AlertCircle, X, Check, ShieldCheck } from 'lucide-react';
import { Campaign } from '../types';

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (campaign: Campaign) => void;
}

export const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({
  isOpen,
  onClose,
  onCreated
}) => {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [mediaZip, setMediaZip] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a campaign name');
      return;
    }
    if (!file) {
      setError('Please select a CSV or Excel contact spreadsheet');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('file', file);
      if (mediaZip) {
        formData.append('mediaZip', mediaZip);
      }

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create campaign');
      }

      onCreated(data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600 border border-emerald-100">
            <UploadCloud className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">Create New Campaign</h2>
            <p className="text-xs text-zinc-500">Upload recipient list and optional media bundle</p>
          </div>
        </div>

        {/* Safety Banner */}
        <div className="mb-5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 flex items-start space-x-3">
          <ShieldCheck className="h-5 w-5 text-emerald-700 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-900">
            <p className="font-semibold text-emerald-950">Safety Protection Guaranteed</p>
            <p className="mt-0.5 text-emerald-800">
              Creating a campaign never sends messages automatically. It starts in <strong>DRAFT</strong> mode.
              You must map fields, review and approve contacts, and explicitly click Start Sending.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 flex items-start space-x-2 text-sm text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1.5">
              Campaign Name <span className="text-red-500">*</span>
            </label>
            <input
              id="input-campaign-name"
              type="text"
              required
              placeholder="e.g. 10be_certificate or march_invoice_blast"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1.5">
              Contact Spreadsheet (.csv, .xlsx, .xls) <span className="text-red-500">*</span>
            </label>
            <div className="relative border-2 border-dashed border-zinc-300 hover:border-emerald-500 rounded-xl p-4 text-center transition-colors bg-zinc-50/50">
              <input
                id="input-contact-file"
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                required
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <FileSpreadsheet className="h-8 w-8 text-zinc-400 mb-2" />
                {file ? (
                  <div className="text-sm font-medium text-emerald-700 flex items-center space-x-1">
                    <Check className="h-4 w-4" />
                    <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-zinc-800">
                      Drag and drop your spreadsheet, or <span className="text-emerald-600 underline">browse</span>
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">Supports UTF-8 CSV, Excel XLSX/XLS</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1.5">
              Media Bundle (.zip) <span className="text-xs font-normal text-zinc-500">(Optional)</span>
            </label>
            <div className="relative border-2 border-dashed border-zinc-300 hover:border-emerald-500 rounded-xl p-4 text-center transition-colors bg-zinc-50/50">
              <input
                id="input-media-zip"
                type="file"
                accept=".zip, application/zip"
                onChange={(e) => setMediaZip(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <Archive className="h-8 w-8 text-zinc-400 mb-2" />
                {mediaZip ? (
                  <div className="text-sm font-medium text-emerald-700 flex items-center space-x-1">
                    <Check className="h-4 w-4" />
                    <span>{mediaZip.name} ({(mediaZip.size / (1024 * 1024)).toFixed(2)} MB)</span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-zinc-800">
                      Upload ZIP of PDFs, images, or documents
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Files will be verified against CSV filename references
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3 pt-2 border-t border-zinc-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-submit-create-campaign"
              type="submit"
              disabled={isSubmitting || !name || !file}
              className="inline-flex items-center space-x-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Importing Data...</span>
                </>
              ) : (
                <span>Create Draft Campaign</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
