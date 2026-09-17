import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Send,
  Users,
  CheckCheck,
  ShieldCheck
} from 'lucide-react';
import { Campaign, CampaignRecord } from '../../types';

interface OverviewTabProps {
  campaign: Campaign;
  records: CampaignRecord[];
  readiness: any;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRetryFailed: () => void;
  onExport: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  campaign,
  records,
  readiness,
  onStart,
  onPause,
  onResume,
  onStop,
  onRetryFailed,
  onExport
}) => {
  const total = campaign.total_records || records.length || 0;
  const approved = campaign.approved_records || records.filter((r) => r.approval_status === 'approved').length;
  const sent = campaign.sent_count || records.filter((r) => r.send_status === 'sent').length;
  const failed = campaign.failed_count || records.filter((r) => r.send_status === 'failed').length;
  const pending = records.filter((r) => r.send_status === 'pending' && r.approval_status === 'approved').length;
  const valid = records.filter((r) => r.validation_status === 'valid').length;
  const invalid = records.filter((r) => r.validation_status === 'invalid').length;
  const remaining = approved > 0 ? Math.max(0, approved - sent - failed) : total;

  const progressPercent = approved > 0 ? Math.min(100, Math.round((sent / approved) * 100)) : 0;

  const checklist = readiness?.checklist || {
    csvImported: total > 0,
    phoneMapped: Boolean(campaign.field_mapping?.destination),
    curlParsed: Boolean(campaign.parsed_template?.url),
    templateMapped: true,
    mediaValidated: true,
    approvedRecordsCount: approved,
    totalRecordsCount: total
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sending':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping"></span>
            <span>SENDING</span>
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            READY TO SEND
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCheck className="h-3.5 w-3.5" />
            <span>COMPLETED</span>
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            PAUSED
          </span>
        );
      case 'stopped':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-zinc-200 text-zinc-800 border border-zinc-300">
            STOPPED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
            DRAFT
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Primary Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-zinc-900">{campaign.name}</h2>
            {getStatusBadge(campaign.status)}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Source file: <span className="font-mono text-zinc-700">{campaign.original_file_name || 'contacts.csv'}</span> •
            Created: {new Date(campaign.created_at).toLocaleString()}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {campaign.status === 'draft' || campaign.status === 'ready' ? (
            <button
              id="btn-start-sending"
              onClick={onStart}
              disabled={!readiness?.isReady || approved === 0}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium text-sm shadow-sm hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 transition-all cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Start Sending</span>
            </button>
          ) : null}

          {campaign.status === 'sending' && (
            <>
              <button
                id="btn-pause-campaign"
                onClick={onPause}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 text-white font-medium text-sm shadow-sm hover:bg-amber-600 cursor-pointer"
              >
                <Pause className="h-4 w-4" />
                <span>Pause</span>
              </button>
              <button
                id="btn-stop-campaign"
                onClick={onStop}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-red-600 text-white font-medium text-sm shadow-sm hover:bg-red-700 cursor-pointer"
              >
                <Square className="h-4 w-4" />
                <span>Stop</span>
              </button>
            </>
          )}

          {campaign.status === 'paused' && (
            <>
              <button
                id="btn-resume-campaign"
                onClick={onResume}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium text-sm shadow-sm hover:bg-emerald-700 cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Resume</span>
              </button>
              <button
                id="btn-stop-campaign"
                onClick={onStop}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-red-600 text-white font-medium text-sm shadow-sm hover:bg-red-700 cursor-pointer"
              >
                <Square className="h-4 w-4" />
                <span>Stop</span>
              </button>
            </>
          )}

          {failed > 0 && (
            <button
              id="btn-retry-failed"
              onClick={onRetryFailed}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-red-300 bg-red-50 text-red-700 font-medium text-sm hover:bg-red-100 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Retry Failed ({failed})</span>
            </button>
          )}

          <button
            id="btn-export-csv"
            onClick={onExport}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 bg-white text-zinc-700 font-medium text-sm hover:bg-zinc-50 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Live Sending Progress Card */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Send className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold text-zinc-900">Campaign Progress</span>
          </div>
          <span className="text-sm font-bold text-zinc-900 font-mono">
            {progressPercent}%
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full h-3.5 bg-zinc-100 rounded-full overflow-hidden flex border border-zinc-200/60 p-0.5">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
          {failed > 0 && approved > 0 && (
            <div
              className="h-full bg-red-500 rounded-full ml-0.5 transition-all duration-500"
              style={{ width: `${Math.min(100 - progressPercent, Math.round((failed / approved) * 100))}%` }}
            />
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-zinc-600">
          <span>
            Sent: <strong className="text-emerald-700">{sent}</strong> / {approved} approved
          </span>
          <span>
            Failed: <strong className={failed > 0 ? 'text-red-600' : 'text-zinc-600'}>{failed}</strong>
          </span>
          <span>
            Remaining: <strong className="text-zinc-800">{remaining}</strong>
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-zinc-200 text-center shadow-2xs">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Total</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 font-mono">{total}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-zinc-200 text-center shadow-2xs">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Valid</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 font-mono">{valid}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-zinc-200 text-center shadow-2xs">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Invalid</p>
          <p className="mt-1 text-2xl font-bold text-red-600 font-mono">{invalid}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-zinc-200 text-center shadow-2xs">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Approved</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600 font-mono">{approved}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-zinc-200 text-center shadow-2xs">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Pending Appr.</p>
          <p className="mt-1 text-2xl font-bold text-zinc-600 font-mono">{total - approved}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-zinc-200 text-center shadow-2xs">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Sent</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 font-mono">{sent}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-zinc-200 text-center shadow-2xs">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Failed</p>
          <p className="mt-1 text-2xl font-bold text-red-600 font-mono">{failed}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-zinc-200 text-center shadow-2xs">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Queue</p>
          <p className="mt-1 text-2xl font-bold text-amber-600 font-mono">{pending}</p>
        </div>
      </div>

      {/* Readiness Checklist */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs">
        <div className="flex items-center space-x-2 mb-4">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <h3 className="text-base font-semibold text-zinc-900">Campaign Pre-Flight Readiness</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center space-x-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50/60">
            {checklist.csvImported ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            )}
            <div className="text-xs">
              <p className="font-semibold text-zinc-900">1. CSV / Spreadsheet Imported</p>
              <p className="text-zinc-500">{total} record(s) parsed</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50/60">
            {checklist.phoneMapped ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            )}
            <div className="text-xs">
              <p className="font-semibold text-zinc-900">2. Phone Destination Mapped</p>
              <p className="text-zinc-500">
                {campaign.field_mapping?.destination
                  ? `Mapped to column "${campaign.field_mapping.destination}"`
                  : 'Destination mapping missing in cURL tab'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50/60">
            {checklist.curlParsed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            )}
            <div className="text-xs">
              <p className="font-semibold text-zinc-900">3. WhatsApp cURL Parsed</p>
              <p className="text-zinc-500">
                {campaign.parsed_template?.url ? campaign.parsed_template.url : 'No API cURL pasted yet'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50/60">
            {checklist.mediaValidated ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            )}
            <div className="text-xs">
              <p className="font-semibold text-zinc-900">4. Media Validation</p>
              <p className="text-zinc-500">All referenced media files found in bundle</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50/60">
            {checklist.approvedRecordsCount > 0 ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            )}
            <div className="text-xs">
              <p className="font-semibold text-zinc-900">5. Manual Record Approval</p>
              <p className="text-zinc-500">{approved} of {total} records approved</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50/60">
            {readiness?.isReady ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            )}
            <div className="text-xs">
              <p className="font-semibold text-zinc-900">6. Ready To Send Status</p>
              <p className="text-zinc-500">
                {readiness?.isReady ? 'All prerequisites met' : `${readiness?.blockers?.length || 1} requirement(s) pending`}
              </p>
            </div>
          </div>
        </div>

        {/* If blockers exist, show detailed list */}
        {readiness?.blockers?.length > 0 && (
          <div className="mt-4 p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900">
            <p className="font-semibold mb-1">Cannot start campaign yet. Requirements pending:</p>
            <ul className="list-disc list-inside space-y-0.5 text-amber-800">
              {readiness.blockers.map((b: string, i: number) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
