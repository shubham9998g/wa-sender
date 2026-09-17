import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  LayoutDashboard,
  Users,
  Code,
  Archive,
  ScrollText,
  Settings as SettingsIcon,
  RefreshCw
} from 'lucide-react';
import { Campaign, CampaignRecord, FieldMapping, ApprovalStatus } from '../types';
import { OverviewTab } from './tabs/OverviewTab';
import { RecordsTab } from './tabs/RecordsTab';
import { CurlMappingTab } from './tabs/CurlMappingTab';
import { MediaTab } from './tabs/MediaTab';
import { LogsTab } from './tabs/LogsTab';
import { SettingsTab } from './tabs/SettingsTab';
import { ConfirmationModal } from './ConfirmationModal';
import { EditRecordModal } from './EditRecordModal';

interface CampaignDetailViewProps {
  campaignId: string;
  onBack: () => void;
}

export const CampaignDetailView: React.FC<CampaignDetailViewProps> = ({
  campaignId,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'records' | 'curl' | 'media' | 'logs' | 'settings'>('overview');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [records, setRecords] = useState<CampaignRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [readiness, setReadiness] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination & filter state for records
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [sendStatusFilter, setSendStatusFilter] = useState('all');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState('all');
  const [validationStatusFilter, setValidationStatusFilter] = useState('all');

  // Modals
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [testSendCount, setTestSendCount] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<CampaignRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch campaign details and readiness
  const fetchCampaign = async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`);
      if (res.ok) {
        const data = await res.json();
        setCampaign(data);
        setReadiness(data.readiness);
      }
    } catch (err) {
      console.error('Failed to load campaign:', err);
    }
  };

  // Fetch paginated records
  const fetchRecords = async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        search,
        sendStatus: sendStatusFilter,
        approvalStatus: approvalStatusFilter,
        validationStatus: validationStatusFilter
      });
      const res = await fetch(`/api/campaigns/${campaignId}/records?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records);
        setTotalRecords(data.total);
      }
    } catch (err) {
      console.error('Failed to load records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaign();
    fetchRecords();
  }, [campaignId, page, pageSize, search, sendStatusFilter, approvalStatusFilter, validationStatusFilter]);

  // Polling while campaign is in 'sending' status
  useEffect(() => {
    if (campaign?.status === 'sending') {
      const interval = setInterval(() => {
        fetchCampaign();
        fetchRecords();
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [campaign?.status, page, pageSize]);

  // Handlers for campaign actions
  const handleStartSending = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/start`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to start campaign');
      } else {
        setIsStartModalOpen(false);
        fetchCampaign();
        fetchRecords();
      }
    } catch (err: any) {
      alert(err.message || 'Error starting campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    await fetch(`/api/campaigns/${campaignId}/pause`, { method: 'POST' });
    fetchCampaign();
  };

  const handleResume = async () => {
    await fetch(`/api/campaigns/${campaignId}/resume`, { method: 'POST' });
    fetchCampaign();
  };

  const handleStop = async () => {
    await fetch(`/api/campaigns/${campaignId}/stop`, { method: 'POST' });
    fetchCampaign();
  };

  const handleRetryFailed = async () => {
    await fetch(`/api/campaigns/${campaignId}/retry`, { method: 'POST' });
    fetchCampaign();
    fetchRecords();
  };

  const handleExportCsv = () => {
    window.location.href = `/api/campaigns/${campaignId}/export`;
  };

  const handleBulkApprove = async (
    target: 'all_valid' | 'all_rejected' | string[],
    status: ApprovalStatus
  ) => {
    if (target === 'all_valid' || target === 'all_rejected') {
      await fetch(`/api/campaigns/${campaignId}/approve-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
      });
    } else {
      await fetch(`/api/campaigns/${campaignId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordIds: target, status })
      });
    }
    fetchCampaign();
    fetchRecords();
  };

  const handleRetrySelected = async (recordIds: string[]) => {
    await fetch(`/api/campaigns/${campaignId}/retry-selected`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordIds })
    });
    fetchCampaign();
    fetchRecords();
  };

  const handleParseCurl = async (curlString: string) => {
    const res = await fetch(`/api/campaigns/${campaignId}/parse-curl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curl: curlString })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to parse cURL');
    fetchCampaign();
  };

  const handleSaveMapping = async (mapping: FieldMapping) => {
    const res = await fetch(`/api/campaigns/${campaignId}/mapping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapping })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save mapping');
    fetchCampaign();
    fetchRecords();
  };

  const handleUploadZip = async (file: File) => {
    const formData = new FormData();
    formData.append('mediaZip', file);
    const res = await fetch(`/api/campaigns/${campaignId}/upload-media`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to extract media ZIP');
    fetchCampaign();
    fetchRecords();
  };

  const handleExecuteTestSend = async () => {
    if (!testSendCount) return;
    setActionLoading(true);
    try {
      // Pick first testSendCount approved pending records and start sending
      const res = await fetch(`/api/campaigns/${campaignId}/start`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) alert(data.error || 'Failed to start test send');
      setTestSendCount(null);
      fetchCampaign();
      fetchRecords();
    } catch (err: any) {
      alert(err.message || 'Error executing test send');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCampaign = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
      if (res.ok) {
        onBack();
      } else {
        alert('Failed to delete campaign');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSettings = async (settings: { send_delay_ms: number; max_attempts: number }) => {
    const res = await fetch(`/api/campaigns/${campaignId}/mapping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mapping: {
          ...campaign?.field_mapping,
          send_delay_ms: settings.send_delay_ms,
          max_attempts: settings.max_attempts
        }
      })
    });
    if (!res.ok) throw new Error('Failed to update settings');
    fetchCampaign();
  };

  if (isLoading && !campaign) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-r-transparent"></div>
        <p className="mt-3 text-sm text-zinc-500">Loading campaign details...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="py-16 text-center">
        <p className="text-zinc-600">Campaign not found.</p>
        <button
          onClick={onBack}
          className="mt-4 inline-flex items-center space-x-1 text-sm text-emerald-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>
    );
  }

  const approvedCount = campaign.approved_records || 0;

  return (
    <div className="space-y-6">
      {/* Back button & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 bg-white px-3 py-1.5 rounded-lg border border-zinc-200 shadow-2xs hover:bg-zinc-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Campaigns</span>
        </button>

        <button
          onClick={() => {
            fetchCampaign();
            fetchRecords();
          }}
          className="p-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-800 shadow-2xs cursor-pointer"
          title="Refresh Data"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-zinc-200 bg-white rounded-xl px-2 shadow-2xs">
        <nav className="-mb-px flex space-x-2 sm:space-x-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center space-x-2 py-3 px-3 border-b-2 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'overview'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('records')}
            className={`flex items-center space-x-2 py-3 px-3 border-b-2 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'records'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Records ({campaign.total_records})</span>
          </button>

          <button
            onClick={() => setActiveTab('curl')}
            className={`flex items-center space-x-2 py-3 px-3 border-b-2 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'curl'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
            }`}
          >
            <Code className="h-4 w-4" />
            <span>cURL & Mapping</span>
          </button>

          <button
            onClick={() => setActiveTab('media')}
            className={`flex items-center space-x-2 py-3 px-3 border-b-2 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'media'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
            }`}
          >
            <Archive className="h-4 w-4" />
            <span>Media Bundle</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center space-x-2 py-3 px-3 border-b-2 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'logs'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
            }`}
          >
            <ScrollText className="h-4 w-4" />
            <span>Live Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center space-x-2 py-3 px-3 border-b-2 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'settings'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
            }`}
          >
            <SettingsIcon className="h-4 w-4" />
            <span>Settings</span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          campaign={campaign}
          records={records}
          readiness={readiness}
          onStart={() => setIsStartModalOpen(true)}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
          onRetryFailed={handleRetryFailed}
          onExport={handleExportCsv}
        />
      )}

      {activeTab === 'records' && (
        <RecordsTab
          campaignId={campaign.id}
          records={records}
          totalRecords={totalRecords}
          currentPage={page}
          pageSize={pageSize}
          searchQuery={search}
          sendStatusFilter={sendStatusFilter}
          approvalStatusFilter={approvalStatusFilter}
          validationStatusFilter={validationStatusFilter}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onSearchChange={setSearch}
          onSendStatusFilterChange={setSendStatusFilter}
          onApprovalStatusFilterChange={setApprovalStatusFilter}
          onValidationStatusFilterChange={setValidationStatusFilter}
          onBulkApprove={handleBulkApprove}
          onRetrySelected={handleRetrySelected}
          onEditRecord={(record) => setEditingRecord(record)}
        />
      )}

      {activeTab === 'curl' && (
        <CurlMappingTab
          campaign={campaign}
          sampleRecord={records[0] || null}
          onParseCurl={handleParseCurl}
          onSaveMapping={handleSaveMapping}
          onTestSend={(count) => {
            setTestSendCount(count);
          }}
        />
      )}

      {activeTab === 'media' && (
        <MediaTab
          campaign={campaign}
          records={records}
          onUploadZip={handleUploadZip}
        />
      )}

      {activeTab === 'logs' && (
        <LogsTab
          campaignId={campaign.id}
          campaignStatus={campaign.status}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsTab
          campaign={campaign}
          onUpdateSettings={handleUpdateSettings}
          onDeleteCampaign={() => setIsDeleteModalOpen(true)}
        />
      )}

      {/* Start Sending Confirmation Modal (Section 83) */}
      <ConfirmationModal
        isOpen={isStartModalOpen}
        title="Start Campaign Delivery?"
        message={
          <div className="space-y-2">
            <p>
              You are about to start sending WhatsApp broadcast messages via the connected API:
            </p>
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-mono space-y-1">
              <div>Campaign: <strong className="text-zinc-900">{campaign.name}</strong></div>
              <div>Approved Records: <strong className="text-emerald-700">{approvedCount}</strong></div>
              <div>Rate Delay: <strong>{campaign.send_delay_ms ?? 1000} ms</strong></div>
              <div>Max Attempts: <strong>{campaign.max_attempts ?? 3}</strong></div>
            </div>
            <p className="text-xs text-amber-700 font-medium">
              This will dispatch real WhatsApp messages through the persistent worker.
            </p>
          </div>
        }
        confirmText="Start Sending"
        variant="success"
        isLoading={actionLoading}
        onConfirm={handleStartSending}
        onCancel={() => setIsStartModalOpen(false)}
      />

      {/* Test Send Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(testSendCount)}
        title={`Send ${testSendCount} Test Message(s)?`}
        message={`You are about to test send ${testSendCount} message(s) through your configured WhatsApp API endpoint. Continue?`}
        confirmText="Send Test Messages"
        variant="primary"
        isLoading={actionLoading}
        onConfirm={handleExecuteTestSend}
        onCancel={() => setTestSendCount(null)}
      />

      {/* Delete Campaign Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title="Delete Campaign?"
        message={`Are you sure you want to delete "${campaign.name}"? All recipient records, media links, and delivery logs will be erased permanently.`}
        confirmText="Delete Campaign"
        variant="danger"
        isLoading={actionLoading}
        onConfirm={handleDeleteCampaign}
        onCancel={() => setIsDeleteModalOpen(false)}
      />

      {/* Edit Record Modal */}
      <EditRecordModal
        isOpen={Boolean(editingRecord)}
        record={editingRecord}
        onClose={() => setEditingRecord(null)}
        onSaved={(updated) => {
          fetchRecords();
          fetchCampaign();
        }}
      />
    </div>
  );
};
