import React, { useState, useEffect } from 'react';
import {
  ListFilter,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  CheckCheck,
  Radio
} from 'lucide-react';
import { CampaignEvent, CampaignStatus } from '../../types';

interface LogsTabProps {
  campaignId: string;
  campaignStatus: CampaignStatus;
}

export const LogsTab: React.FC<LogsTabProps> = ({ campaignId, campaignStatus }) => {
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/logs?limit=200`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Poll every 1.5s if campaign is sending or user enabled auto-refresh
    if (autoRefresh || campaignStatus === 'sending') {
      const interval = setInterval(fetchLogs, 1500);
      return () => clearInterval(interval);
    }
  }, [campaignId, campaignStatus, autoRefresh]);

  const filteredEvents = events.filter((e) => {
    if (filterType !== 'all' && e.event_type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const msg = (e.message || '').toLowerCase();
      const dataStr = JSON.stringify(e.data || '').toLowerCase();
      return msg.includes(q) || dataStr.includes(q);
    }
    return true;
  });

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'sent':
        return (
          <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" />
            <span>SENT</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center space-x-1 text-red-700 bg-red-50 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border border-red-200">
            <XCircle className="h-3 w-3" />
            <span>FAILED</span>
          </span>
        );
      case 'retry':
        return (
          <span className="inline-flex items-center space-x-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border border-amber-200">
            <RotateCcw className="h-3 w-3" />
            <span>RETRY</span>
          </span>
        );
      case 'sending':
        return (
          <span className="inline-flex items-center space-x-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border border-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            <span>SENDING</span>
          </span>
        );
      case 'campaign_started':
        return (
          <span className="inline-flex items-center space-x-1 text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border border-indigo-200">
            <Play className="h-3 w-3 fill-current" />
            <span>STARTED</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center space-x-1 text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border border-emerald-300">
            <CheckCheck className="h-3.5 w-3.5" />
            <span>COMPLETED</span>
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border border-amber-200">
            PAUSED
          </span>
        );
      case 'stopped':
        return (
          <span className="inline-flex items-center text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border border-zinc-200">
            STOPPED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded font-mono text-[11px] border border-zinc-200">
            {type.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Logs Controls */}
      <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 text-zinc-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search logs & responses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 pl-9 pr-3 py-2 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-700 focus:border-emerald-500 focus:outline-hidden"
          >
            <option value="all">All Event Types</option>
            <option value="sending">Sending</option>
            <option value="sent">Sent (Success)</option>
            <option value="failed">Failed</option>
            <option value="retry">Retry</option>
            <option value="campaign_started">Campaign Started</option>
            <option value="completed">Completed</option>
          </select>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              autoRefresh
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white text-zinc-600 border-zinc-300'
            }`}
          >
            <Radio className={`h-3.5 w-3.5 ${autoRefresh ? 'text-emerald-600 animate-pulse' : 'text-zinc-400'}`} />
            <span>Auto-refresh {autoRefresh ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={fetchLogs}
            className="p-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 cursor-pointer"
            title="Refresh Logs Now"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Logs Feed Container */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-950 p-4 font-mono text-xs text-zinc-200 shadow-inner max-h-[600px] overflow-y-auto divide-y divide-zinc-900">
        {filteredEvents.length === 0 ? (
          <div className="py-12 text-center text-zinc-600">
            {isLoading ? 'Loading logs...' : 'No events logged yet for this campaign.'}
          </div>
        ) : (
          filteredEvents.map((e) => (
            <div key={e.id} className="py-2.5 flex items-start space-x-3 hover:bg-zinc-900/60 px-2 rounded-lg transition-colors">
              <span className="text-zinc-500 text-[11px] whitespace-nowrap pt-0.5">
                {new Date(e.created_at).toLocaleTimeString()}
              </span>

              <div className="pt-0.5">{getEventBadge(e.event_type)}</div>

              <div className="flex-1 min-w-0">
                <p className="text-zinc-200 text-xs leading-relaxed break-words">
                  {e.message}
                </p>
                {e.data && (
                  <pre className="mt-1 text-[11px] text-zinc-400 bg-zinc-900/90 p-2 rounded border border-zinc-800/80 overflow-x-auto">
                    {JSON.stringify(e.data, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
