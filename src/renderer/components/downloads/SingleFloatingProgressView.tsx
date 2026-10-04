import React, { useState, useEffect } from 'react';
import {
  Download,
  Pause,
  Play,
  X,
  Minus,
  Folder,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Gauge,
  Layers,
  Sparkles,
} from 'lucide-react';
import { DownloadItem } from '../../../shared/types/download';
import { formatBytes, formatSpeed, formatEta } from '../../../shared/constants/categories';

interface Props {
  downloadId: string;
}

export const SingleFloatingProgressView: React.FC<Props> = ({ downloadId }) => {
  const [item, setItem] = useState<DownloadItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    if (window.electronAPI?.getDownloadById) {
      window.electronAPI.getDownloadById(downloadId).then((data: any) => {
        if (data) setItem(data);
        setLoading(false);
      });
    }

    // Subscribe to live progress
    const unsubProgress = window.electronAPI?.onDownloadProgress?.((updatedItem: DownloadItem) => {
      if (updatedItem.id === downloadId) {
        setItem(updatedItem);
      }
    });

    // Subscribe to live state changes
    const unsubState = window.electronAPI?.onDownloadStateChange?.((updatedItem: DownloadItem) => {
      if (updatedItem.id === downloadId) {
        setItem(updatedItem);
      }
    });

    return () => {
      if (unsubProgress) unsubProgress();
      if (unsubState) unsubState();
    };
  }, [downloadId]);

  const handlePause = async () => {
    if (item && window.electronAPI) {
      await window.electronAPI.pauseDownload(item.id);
    }
  };

  const handleResume = async () => {
    if (item && window.electronAPI) {
      await window.electronAPI.resumeDownload(item.id);
    }
  };

  const handleCancel = async () => {
    if (item && window.electronAPI) {
      await window.electronAPI.cancelDownload(item.id);
      window.close();
    }
  };

  const handleOpenFile = async () => {
    if (item?.filepath && window.electronAPI) {
      await window.electronAPI.openFile(item.filepath);
    }
  };

  const handleOpenFolder = async () => {
    if (item?.filepath && window.electronAPI) {
      await window.electronAPI.openFolder(item.filepath);
    }
  };

  // If item is loading initially, provide instant placeholder state so window renders in 0ms
  const currentItem: DownloadItem = item || {
    id: downloadId,
    url: 'Connecting stream...',
    originalUrl: 'Connecting stream...',
    filename: 'Initializing download stream...',
    filepath: '',
    mimeType: 'application/octet-stream',
    totalSize: 0,
    downloadedSize: 0,
    progress: 0,
    status: 'DOWNLOADING',
    speed: 0,
    avgSpeed: 0,
    eta: 0,
    createdTime: Date.now(),
    priority: 5,
    connections: 8,
    sourceType: 'VIDEO',
    category: 'Videos',
  };

  const isCompleted = currentItem.status === 'COMPLETED';
  const isFailed = currentItem.status === 'FAILED';
  const isPaused = currentItem.status === 'PAUSED';
  const isDownloading = currentItem.status === 'DOWNLOADING';
  const isMerging = currentItem.status === 'MERGING';
  const percent = Math.min(100, Math.max(0, currentItem.progress || 0));

  return (
    <div className="flex flex-col h-screen w-screen bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100 p-4 select-none justify-between overflow-hidden border border-slate-800/80">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
              {isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : isFailed ? (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              ) : (
                <Download className="w-4 h-4 text-cyan-400 animate-pulse" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-slate-100 truncate" title={currentItem.filename}>
                {currentItem.filename}
              </h3>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="bg-slate-800/80 px-1.5 py-0.5 rounded text-cyan-300 font-mono">
                  {currentItem.category || 'Media'}
                </span>
                <span className="truncate max-w-[200px]" title={currentItem.url}>
                  {currentItem.url}
                </span>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isCompleted
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : isFailed
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : isPaused
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : isMerging
                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                  : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
              }`}
            >
              {isCompleted
                ? 'Completed'
                : isFailed
                ? 'Failed'
                : isPaused
                ? 'Paused'
                : isMerging
                ? 'Processing HD'
                : 'Downloading'}
            </span>

            {/* Quick Window Minimize Button */}
            <button
              onClick={async () => {
                if (window.electronAPI?.minimizeCurrentWindow) {
                  await window.electronAPI.minimizeCurrentWindow();
                }
              }}
              title="Minimize to taskbar"
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 mb-1">
            <span>
              <strong className="text-cyan-300 font-semibold">{formatBytes(currentItem.downloadedSize || 0)}</strong>
              <span className="text-slate-500 mx-1">/</span>
              <span className="text-slate-400">{currentItem.totalSize > 0 ? formatBytes(currentItem.totalSize) : 'Dynamic Stream'}</span>
            </span>
            <span className="font-bold text-cyan-400">{percent.toFixed(1)}%</span>
          </div>
          <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isCompleted
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : isFailed
                  ? 'bg-rose-500'
                  : isPaused
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500 shadow-[0_0_12px_rgba(56,189,248,0.5)]'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-slate-800/60 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Gauge className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 block">Speed</span>
              <span className="font-semibold text-slate-100 font-mono">
                {isDownloading ? formatSpeed(currentItem.speed) : '0 B/s'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 block">Time Left</span>
              <span className="font-semibold text-slate-100 font-mono">
                {isDownloading ? formatEta(currentItem.eta) : isCompleted ? 'Done' : '--:--'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-slate-300">
            <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 block">Streams</span>
              <span className="font-semibold text-slate-100 font-mono">
                {currentItem.connections || (currentItem.sourceType === 'VIDEO' ? '16 threads' : '8 threads')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-2">
        <div className="flex items-center gap-2">
          {isDownloading && (
            <button
              onClick={handlePause}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition"
            >
              <Pause className="w-3.5 h-3.5" />
              Pause
            </button>
          )}

          {isPaused && (
            <button
              onClick={handleResume}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold transition"
            >
              <Play className="w-3.5 h-3.5" />
              Resume
            </button>
          )}

          {isCompleted && (
            <button
              onClick={handleOpenFile}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold transition shadow-sm"
            >
              <FileText className="w-3.5 h-3.5" />
              Open File
            </button>
          )}

          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-lg text-xs font-medium transition"
          >
            <Folder className="w-3.5 h-3.5 text-amber-400" />
            Open Folder
          </button>
        </div>

        <button
          onClick={isCompleted ? () => window.close() : handleCancel}
          className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 border border-slate-700/60 rounded-lg text-xs font-medium transition"
        >
          <X className="w-3.5 h-3.5" />
          {isCompleted ? 'Close' : 'Cancel'}
        </button>
      </div>
    </div>
  );
};
