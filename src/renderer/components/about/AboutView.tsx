import React from 'react';
import { ShieldCheck, Cpu, HardDrive, Sparkles, CheckCircle2 } from 'lucide-react';

export const AboutView: React.FC = () => {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 select-none">
      <div className="text-center space-y-3 py-6 border-b border-slate-800">
        <img
          src="./logo.png"
          alt="Vanya Logo"
          className="w-20 h-20 rounded-2xl object-cover mx-auto shadow-2xl shadow-sky-500/30 border border-sky-500/40"
        />
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight uppercase">VANYA DOWNLOADER</h2>
          <p className="text-xs text-sky-400 font-semibold mt-1">Version 1.0.1 (Production Build)</p>
        </div>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          High-performance, 100% free Windows download manager powered by aria2, FFmpeg, and yt-dlp.
        </p>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>No-Nag & Privacy Guarantee</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>100% Free & Open Architecture</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>No Subscriptions or License Keys</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>No Telemetry or Adverts</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Local Database Storage Only</span>
          </div>
        </div>
      </div>

      {/* In-App One-Click Upgrade & Sync Box */}
      <div className="bg-gradient-to-r from-sky-950/40 via-slate-900 to-indigo-950/40 border border-sky-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h4 className="text-sm font-bold text-slate-100">Live Code Sync & In-App Upgrade</h4>
          </div>
          <p className="text-xs text-slate-400">
            Whenever code or features are updated, click below to instantly apply all changes without re-installing!
          </p>
        </div>

        <button
          onClick={async () => {
            try {
              const res = await window.electronAPI.upgradeAndReload();
              alert(res.message || 'Upgraded successfully!');
            } catch {
              window.location.reload();
            }
          }}
          className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-500/25 flex items-center gap-2 shrink-0 transition-all transform active:scale-95"
        >
          <Sparkles className="w-4 h-4" />
          <span>UPGRADE & REFRESH NOW</span>
        </button>
      </div>
    </div>
  );
};
