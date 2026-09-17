import React, { useState } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RotateCcw,
  Edit3,
  ThumbsUp,
  ThumbsDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { CampaignRecord, ApprovalStatus, ValidationStatus, RecordSendStatus } from '../../types';

interface RecordsTabProps {
  campaignId: string;
  records: CampaignRecord[];
  totalRecords: number;
  currentPage: number;
  pageSize: number;
  searchQuery: string;
  sendStatusFilter: string;
  approvalStatusFilter: string;
  validationStatusFilter: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSearchChange: (query: string) => void;
  onSendStatusFilterChange: (status: string) => void;
  onApprovalStatusFilterChange: (status: string) => void;
  onValidationStatusFilterChange: (status: string) => void;
  onBulkApprove: (target: 'all_valid' | 'all_rejected' | string[], status: ApprovalStatus) => void;
  onRetrySelected: (recordIds: string[]) => void;
  onEditRecord: (record: CampaignRecord) => void;
}

export const RecordsTab: React.FC<RecordsTabProps> = ({
  campaignId,
  records,
  totalRecords,
  currentPage,
  pageSize,
  searchQuery,
  sendStatusFilter,
  approvalStatusFilter,
  validationStatusFilter,
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  onSendStatusFilterChange,
  onApprovalStatusFilterChange,
  onValidationStatusFilterChange,
  onBulkApprove,
  onRetrySelected,
  onEditRecord
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Find all dynamic source data keys for headers
  const sourceKeysSet = new Set<string>();
  records.slice(0, 10).forEach((r) => {
    if (r.source_data) {
      Object.keys(r.source_data).forEach((k) => {
        if (k.toLowerCase() !== 'phone' && k.toLowerCase() !== 'mobile') {
          sourceKeysSet.add(k);
        }
      });
    }
  });
  const sourceKeys = Array.from(sourceKeysSet).slice(0, 3); // Display up to 3 custom columns in table

  const toggleSelectAll = () => {
    if (selectedIds.length === records.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(records.map((r) => r.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-zinc-400 absolute left-3 top-3" />
          <input
            id="input-record-search"
            type="text"
            placeholder="Search phone number, name, or metadata..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 pl-9 pr-3 py-2 text-xs sm:text-sm text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Send Status Filter */}
          <select
            id="filter-send-status"
            value={sendStatusFilter}
            onChange={(e) => onSendStatusFilterChange(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-700 focus:border-emerald-500 focus:outline-hidden"
          >
            <option value="all">Send Status: All</option>
            <option value="pending">Pending</option>
            <option value="sending">Sending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>

          {/* Approval Filter */}
          <select
            id="filter-approval-status"
            value={approvalStatusFilter}
            onChange={(e) => onApprovalStatusFilterChange(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-700 focus:border-emerald-500 focus:outline-hidden"
          >
            <option value="all">Approval: All</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Validation Filter */}
          <select
            id="filter-validation-status"
            value={validationStatusFilter}
            onChange={(e) => onValidationStatusFilterChange(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-700 focus:border-emerald-500 focus:outline-hidden"
          >
            <option value="all">Validation: All</option>
            <option value="valid">Valid Only</option>
            <option value="warning">Warnings</option>
            <option value="invalid">Invalid Only</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center space-x-2">
          <button
            id="btn-approve-all-valid"
            onClick={() => onBulkApprove('all_valid', 'approved')}
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 cursor-pointer"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Approve All Valid</span>
          </button>

          <button
            id="btn-reject-all"
            onClick={() => onBulkApprove('all_rejected', 'rejected')}
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-700 text-xs font-medium hover:bg-zinc-50 cursor-pointer"
          >
            <XCircle className="h-3.5 w-3.5 text-red-500" />
            <span>Reject All</span>
          </button>

          {selectedIds.length > 0 && (
            <>
              <button
                id="btn-approve-selected"
                onClick={() => {
                  onBulkApprove(selectedIds, 'approved');
                  setSelectedIds([]);
                }}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 cursor-pointer"
              >
                <span>Approve Selected ({selectedIds.length})</span>
              </button>

              <button
                id="btn-retry-selected"
                onClick={() => {
                  onRetrySelected(selectedIds);
                  setSelectedIds([]);
                }}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Retry Selected ({selectedIds.length})</span>
              </button>
            </>
          )}
        </div>

        <div className="text-xs text-zinc-500">
          Showing <span className="font-semibold text-zinc-800">{records.length}</span> of{' '}
          <span className="font-semibold text-zinc-800">{totalRecords}</span> records
        </div>
      </div>

      {/* Dynamic Records Table */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs text-zinc-600">
          <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-semibold text-zinc-700 uppercase tracking-wider">
            <tr>
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={records.length > 0 && selectedIds.length === records.length}
                  onChange={toggleSelectAll}
                  className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                />
              </th>
              <th className="py-3 px-2 w-12 text-zinc-400">#</th>
              <th className="py-3 px-3">Phone / Destination</th>
              {sourceKeys.map((col) => (
                <th key={col} className="py-3 px-3">
                  {col}
                </th>
              ))}
              <th className="py-3 px-3">Media</th>
              <th className="py-3 px-3">Validation</th>
              <th className="py-3 px-3">Approval</th>
              <th className="py-3 px-3">Delivery Status</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200/70">
            {records.length === 0 ? (
              <tr>
                <td colSpan={8 + sourceKeys.length} className="py-12 text-center text-zinc-400">
                  No records match your criteria.
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const isSelected = selectedIds.includes(r.id);
                return (
                  <tr
                    key={r.id}
                    className={`hover:bg-zinc-50/60 transition-colors ${
                      isSelected ? 'bg-emerald-50/30' : ''
                    }`}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(r.id)}
                        className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>
                    <td className="py-3 px-2 font-mono text-zinc-400">{r.row_number}</td>
                    <td className="py-3 px-3">
                      <div>
                        <span className="font-mono font-medium text-zinc-900">
                          {r.normalized_destination || r.destination || '—'}
                        </span>
                        {r.destination && r.normalized_destination && r.destination !== r.normalized_destination && (
                          <p className="text-[10px] text-zinc-400 font-mono">
                            raw: {r.destination}
                          </p>
                        )}
                      </div>
                    </td>

                    {sourceKeys.map((col) => (
                      <td key={col} className="py-3 px-3 max-w-[140px] truncate text-zinc-700">
                        {r.source_data[col] !== undefined ? String(r.source_data[col]) : '—'}
                      </td>
                    ))}

                    <td className="py-3 px-3 max-w-[150px] truncate">
                      {r.media_source ? (
                        <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                          {r.media_source}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>

                    {/* Validation Status */}
                    <td className="py-3 px-3">
                      {r.validation_status === 'valid' ? (
                        <span className="inline-flex items-center space-x-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Valid</span>
                        </span>
                      ) : r.validation_status === 'warning' ? (
                        <span
                          className="inline-flex items-center space-x-1 text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 cursor-help"
                          title={r.validation_reason || 'Warning'}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          <span>Warning</span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center space-x-1 text-red-700 font-medium bg-red-50 px-2 py-0.5 rounded-md border border-red-200 cursor-help"
                          title={r.validation_reason || 'Invalid phone or media'}
                        >
                          <XCircle className="h-3 w-3" />
                          <span>Invalid</span>
                        </span>
                      )}
                    </td>

                    {/* Approval Status */}
                    <td className="py-3 px-3">
                      {r.approval_status === 'approved' ? (
                        <span className="inline-flex items-center space-x-1 text-indigo-700 font-medium bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                          <Check className="h-3 w-3" />
                          <span>Approved</span>
                        </span>
                      ) : r.approval_status === 'rejected' ? (
                        <span className="inline-flex items-center text-zinc-500 font-medium bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">
                          Rejected
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          Pending
                        </span>
                      )}
                    </td>

                    {/* Delivery Status */}
                    <td className="py-3 px-3">
                      {r.send_status === 'sent' ? (
                        <div>
                          <span className="inline-flex items-center space-x-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <span>SENT</span>
                            {r.provider_status && <span>({r.provider_status})</span>}
                          </span>
                          {r.message_id && (
                            <p className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate max-w-[120px]">
                              ID: {r.message_id}
                            </p>
                          )}
                        </div>
                      ) : r.send_status === 'failed' ? (
                        <div>
                          <span
                            className="inline-flex items-center space-x-1 text-red-700 font-semibold bg-red-50 px-2 py-0.5 rounded-md border border-red-200 cursor-help"
                            title={r.fail_reason || 'Sending failed'}
                          >
                            <span>FAILED</span>
                            {r.provider_status && <span>(HTTP {r.provider_status})</span>}
                          </span>
                          {r.fail_reason && (
                            <p className="text-[10px] text-red-600 font-mono mt-0.5 truncate max-w-[180px]">
                              {r.fail_reason}
                            </p>
                          )}
                        </div>
                      ) : r.send_status === 'sending' ? (
                        <span className="inline-flex items-center space-x-1 text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                          <span>Sending</span>
                        </span>
                      ) : (
                        <span className="text-zinc-400">Queue</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right space-x-1">
                      {r.approval_status !== 'approved' ? (
                        <button
                          title="Approve record"
                          onClick={() => onBulkApprove([r.id], 'approved')}
                          className="p-1 rounded text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          title="Reject record"
                          onClick={() => onBulkApprove([r.id], 'rejected')}
                          className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        title="Edit record"
                        onClick={() => onEditRecord(r)}
                        className="p-1 rounded text-zinc-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>

                      {r.send_status === 'failed' && (
                        <button
                          title="Retry record"
                          onClick={() => onRetrySelected([r.id])}
                          className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center space-x-2 text-xs text-zinc-600">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded border border-zinc-300 px-2 py-1 text-xs"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-zinc-500">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="p-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="p-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
