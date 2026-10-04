import React from 'react';
import {
  X,
  Play,
  Pause,
  FolderOpen,
  FileCheck,
  Zap,
  Activity,
  HardDrive,
  Clock,
  ExternalLink,
  Minimize2,
  Trash2,
  Layers,
  Music,
  Video,
  File,
} from 'lucide-react';
import { useDownloadStore } from '../../stores/useDownloadStore';
import { formatBytes, formatEta } from '@shared/constants/categories';
import { DownloadItem } from '@shared/types/download';

interface SingleProgressDialogProps {
  item: DownloadItem;
  onClose: () => void;
}

const SingleProgressDialog: React.FC<SingleProgressDialogProps> = ({ item, onClose }) => {
  const isCompleted = item.status === 'COMPLETED';
  const isDownloading = item.status === 'DOWNLOADING';
  const isPaused = item.status === 'PAUSED';
  const isFailed = item.status === 'FAILED';

  const handleTogglePause = async () => {
    if (isDownloading) {
      await window.electronAPI.pauseDownload(item.id);
    } else {
      await window.electronAPI.resumeDownload(item.id);
    }
  };

  const handleCancel = async () => {
    await window.electronAPI.cancelDownload(item.id);
    onClose();
  };

  const handleOpenFile = () => {
    window.electronAPI.openFile(item.filepath);
  };

  const handleOpenFolder = () => {
    window.electronAPI.openFolder(item.filepath);
  };

  const isAudio = item.category === 'Music' || item.filepath.endsWith('.mp3') || item.filepath.endsWith('.m4a');
  const isVideo = item.category === 'Videos' || item.sourceType === 'VIDEO';

  return (
    <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col space-y-3.5 p-5 w-full max-w-lg transition-all animate-fade-in backdrop-blur-md">
      {/* Dialog Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`p-2 rounded-xl border shrink-0 ${
              isAudio
                ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                : isVideo
                ? 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            }`}
          >
            {isAudio ? <Music className="w-4 h-4" /> : isVideo ? <Video className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                {isCompleted ? 'Download Finished' : isDownloading ? 'Downloading...' : item.status}
              </h3>
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded font-semibold">
                {item.category}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-semibold truncate max-w-xs" title={item.filename}>
              {item.filename}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onClose}
            title="Minimize / Hide to background"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            title="Close dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar & Percentage */}
      <div className="space-y-1.5 bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-200">
            {isCompleted ? '100% (Completed)' : `${item.progress || 0}%`}
          </span>
          <span className="text-slate-400 font-mono text-[11px]">
            {formatBytes(item.downloadedSize)} / {item.totalSize > 0 ? formatBytes(item.totalSize) : 'Dynamic size'}
          </span>
        </div>

        <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isCompleted
                ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                : isFailed
                ? 'bg-rose-500'
                : isAudio
                ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 animate-pulse'
                : 'bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 animate-pulse'
            }`}
            style={{ width: `${Math.max(1, item.progress || 0)}%` }}
          />
        </div>
      </div>

      {/* Metrics Row (IDM Style) */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/60 flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-sky-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Download Speed</span>
            <span className="font-semibold text-slate-200 truncate block">
              {isDownloading && item.speed ? `${formatBytes(item.speed)}/s` : isCompleted ? 'Completed' : '0 B/s'}
            </span>
          </div>
        </div>

        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/60 flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Time Left (ETA)</span>
            <span className="font-semibold text-slate-200 truncate block">
              {isDownloading && item.eta ? formatEta(item.eta) : isCompleted ? '00:00' : '--'}
            </span>
          </div>
        </div>

        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/60 flex items-center gap-2.5">
          <HardDrive className="w-4 h-4 text-indigo-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Engine / Stream</span>
            <span className="font-semibold text-slate-200 truncate block">
              {item.sourceType === 'VIDEO' ? 'yt-dlp + FFmpeg' : `Aria2 (${item.connections} conns)`}
            </span>
          </div>
        </div>

        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/60 flex items-center gap-2.5">
          <ExternalLink className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Resume Capability</span>
            <span className="font-semibold text-emerald-400 truncate block">Yes</span>
          </div>
        </div>
      </div>

      {/* Save Path */}
      <div className="text-[11px] bg-slate-950/40 p-2 rounded-lg border border-slate-800/40 text-slate-400 flex items-center justify-between gap-2">
        <span className="truncate max-w-sm">Saved in: {item.filepath}</span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
        <div className="flex items-center gap-2">
          {!isCompleted && (
            <button
              onClick={handleTogglePause}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors ${
                isDownloading
                  ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30'
              }`}
            >
              {isDownloading ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isDownloading ? 'Pause' : 'Resume'}</span>
            </button>
          )}

          {!isCompleted && (
            <button
              onClick={handleCancel}
              className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold rounded-xl flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isCompleted && (
            <button
              onClick={handleOpenFile}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Open File</span>
            </button>
          )}

          <button
            onClick={handleOpenFolder}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>Open Folder</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const DownloadProgressModal: React.FC = () => {
  const { downloads, activeProgressModalIds, closeProgressModal, closeAllProgressModals } = useDownloadStore();

  if (!activeProgressModalIds || activeProgressModalIds.length === 0) return null;

  const activeItems = activeProgressModalIds
    .map((id) => downloads.find((d) => d.id === id))
    .filter((item): item is DownloadItem => Boolean(item));

  if (activeItems.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in select-none overflow-y-auto">
      <div className="w-full max-w-4xl flex flex-col items-center space-y-4 my-auto">
        {/* Top Multi-Window Header if more than 1 download */}
        {activeItems.length > 1 && (
          <div className="flex items-center justify-between w-full max-w-lg bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-xl text-xs">
            <div className="flex items-center gap-2 text-slate-200 font-bold">
              <Layers className="w-4 h-4 text-sky-400" />
              <span>{activeItems.length} Parallel Downloads In Progress</span>
            </div>
            <button
              onClick={closeAllProgressModals}
              className="text-slate-400 hover:text-white font-semibold transition-colors"
            >
              Hide All to Background
            </button>
          </div>
        )}

        {/* Dialogs Grid / Stack */}
        <div className={`w-full flex flex-wrap items-center justify-center gap-4 ${activeItems.length > 1 ? 'max-w-4xl' : 'max-w-lg'}`}>
          {activeItems.map((item) => (
            <SingleProgressDialog
              key={item.id}
              item={item}
              onClose={() => closeProgressModal(item.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
