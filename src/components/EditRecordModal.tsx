import React, { useState } from 'react';
import { Edit3, Check, X, AlertCircle, Phone, FileText } from 'lucide-react';
import { CampaignRecord } from '../types';
import { normalizePhoneNumber } from '../../lib/phone';

interface EditRecordModalProps {
  isOpen: boolean;
  record: CampaignRecord | null;
  onClose: () => void;
  onSaved: (updatedRecord: CampaignRecord) => void;
}

export const EditRecordModal: React.FC<EditRecordModalProps> = ({
  isOpen,
  record,
  onClose,
  onSaved
}) => {
  if (!isOpen || !record) return null;

  const [phone, setPhone] = useState(record.destination || '');
  const [mediaSource, setMediaSource] = useState(record.media_source || '');
  const [approvalStatus, setApprovalStatus] = useState(record.approval_status);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phonePreview = normalizePhoneNumber(phone);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/campaigns/${record.campaign_id}/records/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          mediaSource: mediaSource.trim(),
          approvalStatus
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update record');
      }

      onSaved(data.record);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error updating record');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 border border-blue-100">
            <Edit3 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">
              Edit Record #{record.row_number}
            </h3>
            <p className="text-xs text-zinc-500">Correct phone or media to re-validate and send</p>
          </div>
        </div>

        {record.fail_reason && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <p className="font-semibold text-red-900">Previous Failure Cause:</p>
            <p className="mt-0.5 font-mono text-[11px] break-all">{record.fail_reason}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 flex items-start space-x-2 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1">
              Destination Phone Number
            </label>
            <div className="relative">
              <input
                id="edit-record-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9998546899 or +919998546899"
                className="w-full rounded-lg border border-zinc-300 pl-9 pr-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              />
              <Phone className="h-4 w-4 text-zinc-400 absolute left-3 top-2.5" />
            </div>

            {/* Live Phone Normalization Preview */}
            <div className="mt-1.5 flex items-center justify-between text-xs px-1">
              <span className="text-zinc-500">Normalized:</span>
              {phonePreview.isValid ? (
                <span className="font-mono font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {phonePreview.normalized} (VALID)
                </span>
              ) : (
                <span className="font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  {phonePreview.reason || 'Invalid phone number'}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1">
              Referenced Media File Name
            </label>
            <div className="relative">
              <input
                id="edit-record-media"
                type="text"
                value={mediaSource}
                onChange={(e) => setMediaSource(e.target.value)}
                placeholder="e.g. form1_Rahul.pdf"
                className="w-full rounded-lg border border-zinc-300 pl-9 pr-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              />
              <FileText className="h-4 w-4 text-zinc-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1">
              Approval Status
            </label>
            <select
              id="edit-record-approval"
              value={approvalStatus}
              onChange={(e) => setApprovalStatus(e.target.value as any)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-hidden"
            >
              <option value="approved">Approved (Eligible for sending)</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="mt-6 flex justify-end space-x-3 pt-2 border-t border-zinc-100">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-save-edit-record"
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 cursor-pointer"
            >
              {isSaving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Save & Validate</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
