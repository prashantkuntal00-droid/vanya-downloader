import React, { useState } from 'react';
import { History, Search, FolderOpen, ExternalLink, Trash2, CheckCircle2 } from 'lucide-react';
import { useDownloadStore } from '../../stores/useDownloadStore';
import { formatBytes } from '@shared/constants/categories';

export const HistoryTable: React.FC = () => {
  const { downloads, removeDownload } = useDownloadStore();
  const [searchTerm, setSearchTerm] = useState('');

  const completedDownloads = downloads.filter((d) => d.status === 'COMPLETED');
  const filtered = completedDownloads.filter(
    (d) => d.filename.toLowerCase().includes(searchTerm.toLowerCase()) || d.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <History className="w-6 h-6 text-sky-400" />
            <span>Download History</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Review all past completed downloads on your local computer.</p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search completed files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-500">
          No completed downloads found in history.
        </div>
      ) : (
        <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/60 divide-y divide-slate-800/80">
          {filtered.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0" />
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-200 text-sm truncate">{item.filename}</h4>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{item.url}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 text-xs text-slate-400 font-medium">
                <span>{formatBytes(item.totalSize || item.downloadedSize)}</span>
                <div className="flex items-center gap-1.5 ml-2">
                  <button
                    onClick={() => window.electronAPI.openFile(item.filepath)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                    title="Open File"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => window.electronAPI.openFolder(item.filepath)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                    title="Open Folder"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => {
                      removeDownload(item.id);
                      await window.electronAPI.deleteDownload(item.id, false);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400"
                    title="Remove from History"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
