import React, { useState, useEffect } from 'react';
import { X, Search, Folder, Zap, AlertCircle, Loader2 } from 'lucide-react';
import { useDownloadStore } from '../../stores/useDownloadStore';
import { formatBytes } from '@shared/constants/categories';

export const NewDownloadModal: React.FC = () => {
  const { newDownloadModalOpen, closeNewDownloadModal, initialUrlForModal, openProgressModal } = useDownloadStore();

  const [url, setUrl] = useState('');
  const [filename, setFilename] = useState('');
  const [destinationDir, setDestinationDir] = useState('');
  const [connections, setConnections] = useState(8);
  const [priority, setPriority] = useState(5);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedInfo, setAnalyzedInfo] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (newDownloadModalOpen) {
      const initial = initialUrlForModal || '';
      setUrl(initial);
      setErrorMsg('');
      setAnalyzedInfo(null);
      if (initial) {
        handleAnalyze(initial);
      }
      // Fetch default download dir
      window.electronAPI.getSettings().then((s) => {
        setDestinationDir(s.defaultDownloadDir);
        setConnections(s.defaultConnectionsPerDownload);
      });
    }
  }, [newDownloadModalOpen, initialUrlForModal]);

  // Debounced auto-analyze when pasting or typing new URL
  useEffect(() => {
    if (!url || !url.startsWith('http')) return;
    const timer = setTimeout(() => {
      handleAnalyze(url);
    }, 500);
    return () => clearTimeout(timer);
  }, [url]);

  const handleAnalyze = async (targetUrl: string) => {
    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) return;
    setAnalyzing(true);
    setErrorMsg('');
    try {
      const res = await window.electronAPI.analyzeUrl(targetUrl);
      setAnalyzedInfo(res);
      if (res.filename) {
        setFilename(res.filename);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to analyze URL');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSelectDir = async () => {
    const dir = await window.electronAPI.selectDirectory();
    if (dir) {
      setDestinationDir(dir);
    }
  };

  const handleStartDownload = async (startImmediately: boolean = true) => {
    if (!url) {
      setErrorMsg('Please enter a download URL.');
      return;
    }

    try {
      const item = await window.electronAPI.addDownload({
        url,
        filename: filename || undefined,
        destinationDir: destinationDir || undefined,
        connections,
        priority,
        startImmediately,
      });
      closeNewDownloadModal();
      if (startImmediately && item?.id) {
        openProgressModal(item.id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start download');
    }
  };

  if (!newDownloadModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col space-y-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Zap className="w-5 h-5 text-sky-400" />
            <span>New Download</span>
          </h2>
          <button
            onClick={closeNewDownloadModal}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* URL Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">Download URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste download URL here (http://, https://, ftp://)..."
              className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
            <button
              onClick={() => handleAnalyze(url)}
              disabled={analyzing || !url}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-sky-400 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Analyze</span>
            </button>
          </div>
        </div>

        {/* Analyzed Metadata Preview */}
        {(analyzedInfo || analyzing) && (
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Detected Size:</span>
              <span className="font-semibold text-slate-100">
                {analyzing ? (
                  <span className="flex items-center gap-1.5 text-cyan-400 font-mono">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Probing server size...
                  </span>
                ) : analyzedInfo?.totalSize && analyzedInfo.totalSize > 0 ? (
                  <span className="font-bold text-cyan-300 font-mono text-sm bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                    {formatBytes(analyzedInfo.totalSize)}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">Dynamic Stream (Size determined during transfer)</span>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Server Resume Support:</span>
              <span
                className={`font-semibold ${
                  analyzedInfo?.supportsResume ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {analyzing
                  ? 'Checking...'
                  : analyzedInfo?.supportsResume
                  ? '✓ Supported (Multi-Connection Acceleration)'
                  : 'Single Stream'}
              </span>
            </div>
          </div>
        )}

        {/* Filename Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">Filename</label>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="Save filename..."
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Destination Path */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">Save Location</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={destinationDir}
              className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 truncate"
            />
            <button
              onClick={handleSelectDir}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center gap-1.5"
            >
              <Folder className="w-4 h-4" />
              <span>Browse</span>
            </button>
          </div>
        </div>

        {/* Connections & Priority */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Connections</label>
            <select
              value={connections}
              onChange={(e) => setConnections(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none"
            >
              <option value={1}>1 Connection</option>
              <option value={2}>2 Connections</option>
              <option value={4}>4 Connections</option>
              <option value={8}>8 Connections (Default)</option>
              <option value={16}>16 Connections</option>
              <option value={32}>32 Connections (Max)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none"
            >
              <option value={10}>Highest (10)</option>
              <option value={7}>High (7)</option>
              <option value={5}>Normal (5)</option>
              <option value={3}>Low (3)</option>
              <option value={1}>Lowest (1)</option>
            </select>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
          <button
            onClick={() => handleStartDownload(false)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
          >
            START LATER
          </button>
          <button
            onClick={() => handleStartDownload(true)}
            className="px-5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-500/20 transition-all"
          >
            START DOWNLOAD
          </button>
        </div>
      </div>
    </div>
  );
};
