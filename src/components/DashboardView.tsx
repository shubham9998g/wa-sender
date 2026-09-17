import React, { useState } from 'react';
import {
  Send,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  ArrowRight,
  Trash2,
  FileSpreadsheet,
  CheckCheck,
  BarChart3,
  Layers
} from 'lucide-react';
import { Campaign } from '../types';

interface DashboardViewProps {
  campaigns: Campaign[];
  onSelectCampaign: (id: string) => void;
  onNewCampaign: () => void;
  onDeleteCampaign: (id: string, name: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  campaigns,
  onSelectCampaign,
  onNewCampaign,
  onDeleteCampaign
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = campaigns.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Calculate totals
  const totalSent = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0);
  const totalFailed = campaigns.reduce((acc, c) => acc + (c.failed_count || 0), 0);
  const totalRecipients = campaigns.reduce((acc, c) => acc + (c.total_records || 0), 0);
  const activeCount = campaigns.filter((c) => c.status === 'sending').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sending':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            <span>SENDING</span>
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            READY
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCheck className="h-3 w-3" />
            <span>COMPLETED</span>
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            PAUSED
          </span>
        );
      case 'stopped':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
            STOPPED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-50 text-zinc-600 border border-zinc-200">
            DRAFT
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Campaigns</p>
            <Layers className="h-5 w-5 text-zinc-400" />
          </div>
          <p className="mt-2 text-3xl font-bold text-zinc-900 font-mono">{campaigns.length}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {activeCount > 0 ? (
              <span className="text-blue-600 font-medium">{activeCount} actively sending</span>
            ) : (
              'None currently broadcasting'
            )}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total Delivered</p>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-emerald-600 font-mono">{totalSent}</p>
          <p className="mt-1 text-xs text-zinc-500">Across all WhatsApp campaigns</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Delivery Failures</p>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-red-600 font-mono">{totalFailed}</p>
          <p className="mt-1 text-xs text-zinc-500">Failed / un-deliverable records</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total Imported</p>
            <BarChart3 className="h-5 w-5 text-indigo-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-indigo-600 font-mono">{totalRecipients}</p>
          <p className="mt-1 text-xs text-zinc-500">Recipients parsed from CSV/Excel</p>
        </div>
      </div>

      {/* Campaign List Header & Controls */}
      <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 text-zinc-400 absolute left-3 top-3" />
          <input
            id="input-search-campaigns"
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 pl-9 pr-3 py-2 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center space-x-3">
          <select
            id="select-filter-campaign-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 focus:border-emerald-500 focus:outline-hidden"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
            <option value="sending">Sending</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="stopped">Stopped</option>
          </select>

          <button
            id="btn-dashboard-new-campaign"
            onClick={onNewCampaign}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs text-zinc-600">
          <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-semibold text-zinc-700 uppercase tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Campaign Name</th>
              <th className="py-3.5 px-3">Status</th>
              <th className="py-3.5 px-3">Progress</th>
              <th className="py-3.5 px-3">Recipients</th>
              <th className="py-3.5 px-3">Source File</th>
              <th className="py-3.5 px-3">Created</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200/70">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-zinc-400">
                  <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 text-zinc-300" />
                  <p className="text-sm font-medium text-zinc-600">No campaigns found</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Click "Create Campaign" to upload your first contact spreadsheet.
                  </p>
                  <button
                    onClick={onNewCampaign}
                    className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Campaign</span>
                  </button>
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const approved = c.approved_records || 0;
                const sent = c.sent_count || 0;
                const percent = approved > 0 ? Math.min(100, Math.round((sent / approved) * 100)) : 0;

                return (
                  <tr
                    key={c.id}
                    onClick={() => onSelectCampaign(c.id)}
                    className="hover:bg-zinc-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div>
                        <span className="text-sm font-semibold text-zinc-900 hover:text-emerald-700">
                          {c.name}
                        </span>
                        {c.parsed_template?.url && (
                          <p className="text-[10px] text-zinc-400 truncate max-w-xs font-mono">
                            {c.parsed_template.url}
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-3">{getStatusBadge(c.status)}</td>

                    <td className="py-4 px-3 w-48">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                          <span>{sent} sent</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-3">
                      <span className="font-mono font-medium text-zinc-900">
                        {c.total_records || 0}
                      </span>{' '}
                      <span className="text-[11px] text-zinc-400">({approved} approved)</span>
                    </td>

                    <td className="py-4 px-3 text-zinc-500 font-mono text-[11px]">
                      {c.original_file_name || 'contacts.csv'}
                    </td>

                    <td className="py-4 px-3 text-zinc-400 text-[11px]">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div
                        className="inline-flex items-center space-x-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => onSelectCampaign(c.id)}
                          className="p-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
                          title="Open Campaign"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDeleteCampaign(c.id, c.name)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Delete Campaign"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
