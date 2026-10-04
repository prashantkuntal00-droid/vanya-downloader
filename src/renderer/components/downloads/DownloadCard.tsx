import React from 'react';
import {
  FileText,
  Video,
  Music,
  FileCode,
  Archive,
  File,
  Pause,
  Play,
  XSquare,
  FolderOpen,
  ExternalLink,
  RotateCcw,
  Trash2,
  Zap,
} from 'lucide-react';
import { DownloadItem } from '@shared/types/download';
import { formatBytes, formatSpeed, formatEta } from '@shared/constants/categories';
import { useDownloadStore } from '../../stores/useDownloadStore';

interface DownloadCardProps {
  item: DownloadItem;
}

export const DownloadCard: React.FC<DownloadCardProps> = ({ item }) => {
  const { openProgressModal } = useDownloadStore();

  const getCategoryIcon = () => {
    switch (item.category) {
      case 'Videos': return <Video className="w-5 h-5 text-sky-400" />;
      case 'Music': return <Music className="w-5 h-5 text-purple-400" />;
      case 'Documents': return <FileText className="w-5 h-5 text-amber-400" />;
      case 'Programs': return <FileCode className="w-5 h-5 text-emerald-400" />;
      case 'Archives': return <Archive className="w-5 h-5 text-indigo-400" />;
      default: return <File className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusBadge = () => {
    switch (item.status) {
      case 'DOWNLOADING':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 animate-pulse">Downloading</span>;
      case 'QUEUED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">Queued</span>;
      case 'PAUSED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">Paused</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">Completed</span>;
      case 'FAILED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">Failed</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">Cancelled</span>;
      case 'MERGING':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">Merging...</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">{item.status}</span>;
    }
  };

  const { removeDownload } = useDownloadStore();

  const handlePause = () => window.electronAPI.pauseDownload(item.id);
  const handleResume = () => window.electronAPI.resumeDownload(item.id);
  const handleCancel = () => window.electronAPI.cancelDownload(item.id);
  const handleRetry = () => window.electronAPI.retryDownload(item.id);
  const handleOpenFile = () => window.electronAPI.openFile(item.filepath);
  const handleOpenFolder = () => window.electronAPI.openFolder(item.filepath);
  const handleDelete = async () => {
    removeDownload(item.id);
    await window.electronAPI.deleteDownload(item.id, false);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 transition-all shadow-sm space-y-3">
      {/* Header Info */}
      <div
        onClick={() => openProgressModal(item.id)}
        className="flex items-start justify-between gap-3 cursor-pointer group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 shrink-0 group-hover:border-sky-500/50 transition-colors">
            {getCategoryIcon()}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-100 text-sm truncate leading-tight group-hover:text-sky-300 transition-colors" title={item.filename}>
              {item.filename}
            </h3>
            <p className="text-xs text-slate-400 truncate mt-0.5">{item.url}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {getStatusBadge()}
        </div>
      </div>

      {/* Progress Bar & Percentage */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>
            {formatBytes(item.downloadedSize)} {item.totalSize > 0 ? `/ ${formatBytes(item.totalSize)}` : ''}
          </span>
          <span className="font-bold text-slate-200">{item.progress}%</span>
        </div>
        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/40">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              item.status === 'COMPLETED'
                ? 'bg-sky-500'
                : item.status === 'FAILED'
                ? 'bg-rose-500'
                : 'bg-gradient-to-r from-sky-500 to-blue-600'
            }`}
            style={{ width: `${item.progress}%` }}
          />
        </div>
      </div>

      {/* Metrics Row & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
        {/* Real-time stats */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-400">
          {item.status === 'DOWNLOADING' && (
            <>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                ↓ {formatSpeed(item.speed)}
              </span>
              <span>ETA {formatEta(item.eta)}</span>
              <span className="flex items-center gap-1 text-slate-300">
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                {item.connections} connections
              </span>
            </>
          )}
          {item.status === 'COMPLETED' && <span className="text-sky-400">Finished</span>}
          {item.status === 'FAILED' && (
            <span className="text-rose-400 truncate max-w-xs">{item.errorMessage || 'Download error'}</span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 ml-auto">
          {item.status !== 'COMPLETED' && (
            <button
              onClick={() => {
                if (window.electronAPI?.openProgressWindow) {
                  window.electronAPI.openProgressWindow(item.id);
                } else {
                  openProgressModal(item.id);
                }
              }}
              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-cyan-500/20 text-cyan-400 border border-slate-700/60 transition-colors"
              title="Pop out Floating Progress Window"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          {item.status === 'DOWNLOADING' && (
            <button
              onClick={handlePause}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Pause"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}

          {(item.status === 'PAUSED' || item.status === 'QUEUED') && (
            <button
              onClick={handleResume}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 transition-colors"
              title="Resume"
            >
              <Play className="w-4 h-4 fill-emerald-400" />
            </button>
          )}

          {item.status === 'FAILED' && (
            <button
              onClick={handleRetry}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 transition-colors"
              title="Retry"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {item.status === 'DOWNLOADING' && (
            <button
              onClick={handleCancel}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 transition-colors"
              title="Cancel"
            >
              <XSquare className="w-4 h-4" />
            </button>
          )}

          {item.status === 'COMPLETED' && (
            <button
              onClick={handleOpenFile}
              className="px-2.5 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open</span>
            </button>
          )}

          <button
            onClick={handleOpenFolder}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Open Containing Folder"
          >
            <FolderOpen className="w-4 h-4" />
          </button>

          <button
            onClick={handleDelete}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
            title="Remove from History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
