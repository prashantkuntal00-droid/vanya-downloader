import React from 'react';
import {
  Plus,
  Play,
  Pause,
  RotateCcw,
  XSquare,
  Trash2,
  Gauge,
  Activity,
  CheckCircle,
  Clock,
  HardDrive,
} from 'lucide-react';
import { useDownloadStore } from '../../stores/useDownloadStore';
import { formatBytes, formatSpeed } from '@shared/constants/categories';

export const HeaderStats: React.FC = () => {
  const { stats, openNewDownloadModal } = useDownloadStore();

  const handleStartAll = () => window.electronAPI.startAll();
  const handlePauseAll = () => window.electronAPI.pauseAll();
  const handleResumeAll = () => window.electronAPI.resumeAll();
  const handleCancelAll = () => window.electronAPI.cancelAll();
  const handleClearHistory = () => window.electronAPI.clearHistory();

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 p-5 space-y-4">
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Main Action Button */}
        <button
          onClick={() => openNewDownloadModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-sky-500/25 transition-all transform active:scale-95"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>New Download</span>
        </button>

        {/* Global Batch Controls */}
        <div className="flex items-center gap-1.5 bg-slate-800/60 p-1 rounded-xl border border-slate-700/50">
          <button
            onClick={handleStartAll}
            title="Start All"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors"
          >
            <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
            <span>Start All</span>
          </button>
          <button
            onClick={handlePauseAll}
            title="Pause All"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors"
          >
            <Pause className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>Pause All</span>
          </button>
          <button
            onClick={handleResumeAll}
            title="Resume All"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
            <span>Resume All</span>
          </button>
          <button
            onClick={handleCancelAll}
            title="Cancel All"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors"
          >
            <XSquare className="w-3.5 h-3.5 text-rose-400" />
            <span>Cancel All</span>
          </button>
          <div className="w-px h-4 bg-slate-700 mx-1" />
          <button
            onClick={handleClearHistory}
            title="Clear Completed History"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        </div>

        {/* In-App One-Click Upgrade & Sync Button */}
        <button
          onClick={async () => {
            try {
              if (window.electronAPI) {
                const freshDownloads = await window.electronAPI.getDownloads();
                const freshStats = await window.electronAPI.getStats();
                if (freshDownloads) useDownloadStore.getState().setDownloads(freshDownloads);
                if (freshStats) useDownloadStore.getState().setStats(freshStats);
              }
            } catch {}
          }}
          title="Click to instantly sync and refresh downloads and state"
          className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-500/20 to-sky-500/20 hover:from-emerald-500/30 hover:to-sky-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold shadow-md shadow-emerald-500/10 transition-all transform active:scale-95 group"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="group-hover:text-white transition-colors">⚡ UPGRADE / SYNC APP</span>
        </button>
      </div>

      {/* Dashboard Stats Widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Current Speed</p>
            <p className="text-sm font-bold text-slate-100">{formatSpeed(stats?.currentGlobalSpeed || 0)}</p>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Active</p>
            <p className="text-sm font-bold text-slate-100">{stats?.activeCount || 0}</p>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Queued</p>
            <p className="text-sm font-bold text-slate-100">{stats?.queuedCount || 0}</p>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Completed</p>
            <p className="text-sm font-bold text-slate-100">{stats?.completedCount || 0}</p>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Today</p>
            <p className="text-sm font-bold text-slate-100">{formatBytes(stats?.todayDownloadedBytes || 0)}</p>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Downloaded</p>
            <p className="text-sm font-bold text-slate-100">{formatBytes(stats?.totalDownloadedBytes || 0)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
