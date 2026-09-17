import React, { useEffect, useState } from 'react';
import { Send, Activity, Plus, Database, RefreshCw } from 'lucide-react';
import { WorkerHeartbeat } from '../types';

interface NavbarProps {
  onNewCampaign: () => void;
  onGoHome: () => void;
  activeCampaignName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onNewCampaign,
  onGoHome,
  activeCampaignName
}) => {
  const [workerStatus, setWorkerStatus] = useState<WorkerHeartbeat & { online: boolean }>({
    id: 'primary',
    last_seen: '',
    online: false
  });

  const checkWorker = async () => {
    try {
      const res = await fetch('/api/worker/status');
      if (res.ok) {
        const data = await res.json();
        setWorkerStatus(data);
      }
    } catch {
      setWorkerStatus((prev) => ({ ...prev, online: false }));
    }
  };

  useEffect(() => {
    checkWorker();
    const interval = setInterval(checkWorker, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-sm shadow-xs">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={onGoHome}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/20">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-lg tracking-tight text-zinc-900">
                WhatsApp Campaign Manager
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200/60">
                v2.0
              </span>
            </div>
            {activeCampaignName && (
              <p className="text-xs text-zinc-500 truncate max-w-xs">
                Campaign: <span className="font-medium text-zinc-800">{activeCampaignName}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Worker Status Indicator */}
          <div
            className="flex items-center space-x-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs"
            title={workerStatus.online ? `Worker online (Host: ${workerStatus.hostname || 'default'})` : 'Worker offline. Start worker via: npm run worker'}
          >
            <span className="relative flex h-2.5 w-2.5">
              {workerStatus.online && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  workerStatus.online ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              ></span>
            </span>
            <span className="text-zinc-600">Worker:</span>
            <span className={workerStatus.online ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
              {workerStatus.online ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* New Campaign Button */}
          <button
            id="btn-nav-new-campaign"
            onClick={onNewCampaign}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Campaign</span>
          </button>
        </div>
      </div>
    </header>
  );
};
