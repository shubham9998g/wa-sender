import React, { useState } from 'react';
import { Settings, Trash2, Save, Check, AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import { Campaign } from '../../types';

interface SettingsTabProps {
  campaign: Campaign;
  onUpdateSettings: (settings: { send_delay_ms: number; max_attempts: number }) => Promise<void>;
  onDeleteCampaign: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  campaign,
  onUpdateSettings,
  onDeleteCampaign
}) => {
  const [sendDelay, setSendDelay] = useState(campaign.send_delay_ms ?? 1000);
  const [maxAttempts, setMaxAttempts] = useState(campaign.max_attempts ?? 3);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await onUpdateSettings({
        send_delay_ms: Number(sendDelay),
        max_attempts: Number(maxAttempts)
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Sending Configuration Card */}
      <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-xs">
        <div className="flex items-center space-x-2 mb-4">
          <Settings className="h-5 w-5 text-emerald-600" />
          <h3 className="text-base font-semibold text-zinc-900">Delivery & Rate Limiting Settings</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1">
              Delay Between Messages (Milliseconds)
            </label>
            <input
              type="number"
              min={100}
              max={60000}
              step={100}
              value={sendDelay}
              onChange={(e) => setSendDelay(Number(e.target.value))}
              className="w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Default is 1000ms (1 message per second). Recommended for WhatsApp broadcast rate-limit compliance.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1">
              Maximum Retry Attempts for Transient Errors
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
              className="w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Only transient errors (408, 429, 500+) are automatically retried. Permanent errors (400, 401, 403, 404, 422) require manual review.
            </p>
          </div>

          <div className="pt-2 flex items-center space-x-3">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 cursor-pointer shadow-xs"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
            </button>
            {savedSuccess && (
              <span className="inline-flex items-center space-x-1 text-xs text-emerald-700 font-medium">
                <Check className="h-4 w-4" />
                <span>Settings saved successfully</span>
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="p-6 rounded-2xl bg-white border border-red-200 shadow-xs">
        <div className="flex items-center space-x-2 mb-2 text-red-600">
          <Trash2 className="h-5 w-5" />
          <h3 className="text-base font-semibold">Danger Zone</h3>
        </div>
        <p className="text-xs text-zinc-600 mb-4">
          Permanently delete this campaign, all recipient records, media references, and delivery logs. This action cannot be undone.
        </p>

        <button
          type="button"
          onClick={onDeleteCampaign}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer shadow-xs"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete Campaign</span>
        </button>
      </div>
    </div>
  );
};
