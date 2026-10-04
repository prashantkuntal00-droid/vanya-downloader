import React, { useState, useEffect } from 'react';
import { Save, Folder, Shield, Bell, Zap, Monitor, Terminal, RefreshCw, DownloadCloud, CheckCircle2, AlertCircle, ArrowUpCircle } from 'lucide-react';
import { AppSettings } from '@shared/types/settings';
import { UpdateStatus } from '@shared/types/update';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    window.electronAPI.getSettings().then(setSettings);

    // Fetch initial updater status
    if (window.electronAPI.getUpdateStatus) {
      window.electronAPI.getUpdateStatus().then(setUpdateStatus).catch(() => {});
    }

    // Subscribe to live updater events
    if (window.electronAPI.onUpdateStatusChange) {
      const unsub = window.electronAPI.onUpdateStatusChange((status: UpdateStatus) => {
        setUpdateStatus(status);
        if (status.state !== 'CHECKING') {
          setIsCheckingUpdate(false);
        }
      });
      return () => unsub();
    }
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    const updated = await window.electronAPI.updateSettings(settings);
    setSettings(updated);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  const handleSelectDir = async () => {
    const dir = await window.electronAPI.selectDirectory();
    if (dir && settings) {
      setSettings({ ...settings, defaultDownloadDir: dir });
    }
  };

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      await window.electronAPI.checkForUpdates();
    } catch {
      setIsCheckingUpdate(false);
    }
  };

  const handleDownloadUpdate = async () => {
    try {
      await window.electronAPI.downloadUpdate();
    } catch (err) {
      console.error('Failed to trigger update download:', err);
    }
  };

  const handleQuitAndInstall = async () => {
    try {
      await window.electronAPI.quitAndInstall();
    } catch (err) {
      console.error('Failed to quit and install update:', err);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  if (!settings) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Application Settings</h2>
          <p className="text-xs text-slate-400 mt-0.5">Customize download engine preferences, speed limits, and UI behavior.</p>
        </div>
        <button
          onClick={handleSave}
          className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-sky-500/20"
        >
          <Save className="w-4 h-4" />
          <span>Save Settings</span>
        </button>
      </div>

      {savedMsg && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-400 font-medium">
          Settings saved successfully!
        </div>
      )}

      <div className="space-y-6 text-xs">
        {/* Updates & Version Section */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-sky-400" />
              <span>Software Updates & Releases</span>
            </h3>
            <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg text-[11px] font-mono">
              Current: v{updateStatus?.currentVersion || '1.0.1'}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-200">
                  {updateStatus?.state === 'UP_TO_DATE' && 'You are up to date!'}
                  {updateStatus?.state === 'UPDATE_AVAILABLE' && `Update available: v${updateStatus.availableVersion}`}
                  {updateStatus?.state === 'DOWNLOADING' && `Downloading update v${updateStatus.availableVersion}...`}
                  {updateStatus?.state === 'DOWNLOADED' && `Vanya Downloader v${updateStatus.availableVersion} is ready to install!`}
                  {updateStatus?.state === 'CHECKING' && 'Checking GitHub for updates...'}
                  {updateStatus?.state === 'ERROR' && (updateStatus.error || 'Unable to check for updates.')}
                  {(!updateStatus || updateStatus.state === 'IDLE') && 'Check for official GitHub updates.'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {updateStatus?.lastChecked
                    ? `Last checked: ${new Date(updateStatus.lastChecked).toLocaleTimeString()}`
                    : 'Channel: Official GitHub Release'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {(!updateStatus || updateStatus.state === 'IDLE' || updateStatus.state === 'UP_TO_DATE' || updateStatus.state === 'ERROR') && (
                  <button
                    onClick={handleCheckForUpdates}
                    disabled={isCheckingUpdate}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl flex items-center gap-2 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin text-sky-400' : ''}`} />
                    <span>{isCheckingUpdate ? 'Checking...' : 'Check for Updates'}</span>
                  </button>
                )}

                {updateStatus?.state === 'UPDATE_AVAILABLE' && (
                  <button
                    onClick={handleDownloadUpdate}
                    className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-sky-500/20"
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    <span>Download Update (v{updateStatus.availableVersion})</span>
                  </button>
                )}

                {updateStatus?.state === 'DOWNLOADED' && (
                  <button
                    onClick={handleQuitAndInstall}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Restart & Install</span>
                  </button>
                )}
              </div>
            </div>

            {/* Download Progress Bar */}
            {updateStatus?.state === 'DOWNLOADING' && updateStatus.progress && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>{updateStatus.progress.percent.toFixed(1)}% downloaded</span>
                  <span>
                    {formatBytes(updateStatus.progress.transferred)} / {formatBytes(updateStatus.progress.total)}
                    {updateStatus.progress.bytesPerSecond > 0 && ` (${formatBytes(updateStatus.progress.bytesPerSecond)}/s)`}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-sky-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, updateStatus.progress.percent))}%` }}
                  />
                </div>
              </div>
            )}

            {/* Release notes if available */}
            {updateStatus?.releaseNotes && (
              <div className="mt-3 p-3 bg-slate-900/90 rounded-lg border border-slate-800 text-[11px] text-slate-300 space-y-1 max-h-32 overflow-y-auto">
                <p className="font-semibold text-slate-200">What's New in v{updateStatus.availableVersion}:</p>
                <div className="whitespace-pre-line text-slate-400">{updateStatus.releaseNotes}</div>
              </div>
            )}
          </div>
        </div>

        {/* Download Preferences */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Folder className="w-4 h-4 text-sky-400" />
            <span>Download Directories & Categorization</span>
          </h3>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300">Default Download Folder</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={settings.defaultDownloadDir}
                className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300"
              />
              <button
                onClick={handleSelectDir}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl"
              >
                Browse
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={settings.autoCategorize}
              onChange={(e) => setSettings({ ...settings, autoCategorize: e.target.checked })}
              className="rounded bg-slate-950 border-slate-800 text-sky-500 focus:ring-0"
            />
            <span className="text-slate-300 font-medium">Auto-categorize downloads into subfolders (Videos, Music, Documents, Archives, Programs)</span>
          </label>
        </div>

        {/* Connection Engine Settings */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Connection Engine & Limits</span>
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Max Simultaneous Downloads</label>
              <select
                value={settings.maxSimultaneousDownloads}
                onChange={(e) => setSettings({ ...settings, maxSimultaneousDownloads: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
              >
                {[1, 2, 3, 4, 5, 8, 10].map((num) => (
                  <option key={num} value={num}>{num} Simultaneous Downloads</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Default Connections Per Download</label>
              <select
                value={settings.defaultConnectionsPerDownload}
                onChange={(e) => setSettings({ ...settings, defaultConnectionsPerDownload: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
              >
                {[1, 2, 4, 8, 16, 32].map((num) => (
                  <option key={num} value={num}>{num} Connections</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Integration & Notifications */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-400" />
            <span>Integration & System Notifications</span>
          </h3>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enableClipboardMonitoring}
              onChange={(e) => setSettings({ ...settings, enableClipboardMonitoring: e.target.checked })}
              className="rounded bg-slate-950 border-slate-800 text-sky-500"
            />
            <span className="text-slate-300">Enable Clipboard URL Auto-Detection</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enableBrowserIntegration}
              onChange={(e) => setSettings({ ...settings, enableBrowserIntegration: e.target.checked })}
              className="rounded bg-slate-950 border-slate-800 text-sky-500"
            />
            <span className="text-slate-300">Enable Browser Extension Integration Server (Port 18792)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.startWithWindows}
              onChange={(e) => setSettings({ ...settings, startWithWindows: e.target.checked })}
              className="rounded bg-slate-950 border-slate-800 text-sky-500"
            />
            <span className="text-slate-300 font-medium">Start Vanya Downloader automatically on Windows startup (Background Tray Mode)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.closeToTray}
              onChange={(e) => setSettings({ ...settings, closeToTray: e.target.checked })}
              className="rounded bg-slate-950 border-slate-800 text-sky-500"
            />
            <span className="text-slate-300">Minimize to Windows System Tray on Close</span>
          </label>
        </div>

        {/* Diagnostics & Logs */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <div>
              <p className="font-bold text-slate-200">Diagnostics & Application Logs</p>
              <p className="text-[11px] text-slate-400">Open local diagnostics folder to review application logs.</p>
            </div>
          </div>
          <button
            onClick={() => window.electronAPI.openLogsFolder()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl"
          >
            Open Logs Directory
          </button>
        </div>
      </div>
    </div>
  );
};
