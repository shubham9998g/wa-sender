import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { CampaignDetailView } from './components/CampaignDetailView';
import { CreateCampaignModal } from './components/CreateCampaignModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { Campaign } from './types';

export default function App() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCampaignCreated = (newCampaign: Campaign) => {
    setCampaigns((prev) => [newCampaign, ...prev]);
    setSelectedCampaignId(newCampaign.id);
  };

  const handleDeleteCampaign = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/campaigns/${deleteTarget.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setCampaigns((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        if (selectedCampaignId === deleteTarget.id) {
          setSelectedCampaignId(null);
        }
        setDeleteTarget(null);
      }
    } catch (err) {
      console.error('Failed to delete campaign:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const activeCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  return (
    <div className="min-h-screen bg-zinc-100/70 font-sans text-zinc-900 antialiased flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Application Header */}
      <Navbar
        onNewCampaign={() => setIsCreateModalOpen(true)}
        onGoHome={() => setSelectedCampaignId(null)}
        activeCampaignName={activeCampaign?.name}
      />

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {selectedCampaignId ? (
          <CampaignDetailView
            campaignId={selectedCampaignId}
            onBack={() => {
              setSelectedCampaignId(null);
              fetchCampaigns();
            }}
          />
        ) : (
          <DashboardView
            campaigns={campaigns}
            onSelectCampaign={(id) => setSelectedCampaignId(id)}
            onNewCampaign={() => setIsCreateModalOpen(true)}
            onDeleteCampaign={(id, name) => setDeleteTarget({ id, name })}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200/80 bg-white py-4 text-center text-xs text-zinc-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>WhatsApp Campaign & Document Delivery Engine • Built for high reliability & atomic worker execution</p>
          <p className="font-mono text-zinc-400 text-[11px]">Safe cURL Parsing • Zip Slip Protection • E.164</p>
        </div>
      </footer>

      {/* Create Campaign Modal */}
      <CreateCampaignModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleCampaignCreated}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Campaign?"
        message={`Are you sure you want to permanently delete "${deleteTarget?.name}"? All records, events, and media mappings will be erased.`}
        confirmText="Delete Campaign"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteCampaign}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
