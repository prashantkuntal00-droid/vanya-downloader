import React from 'react';
import {
  Download,
  ListOrdered,
  CheckCircle2,
  Video,
  History,
  Calendar,
  Settings,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useDownloadStore } from '../../stores/useDownloadStore';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, stats } = useDownloadStore();

  const navItems = [
    { id: 'downloads', label: 'Downloads', icon: Download, badge: stats?.activeCount },
    { id: 'queue', label: 'Queue', icon: ListOrdered, badge: stats?.queuedCount },
    { id: 'completed', label: 'Completed', icon: CheckCircle2, badge: stats?.completedCount },
    { id: 'video', label: 'Video Downloader', icon: Video },
    { id: 'history', label: 'History', icon: History },
    { id: 'scheduler', label: 'Scheduler', icon: Calendar },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <aside className="w-64 bg-slate-900/80 border-r border-slate-800 flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
        <img
          src="./logo.png"
          alt="Vanya Logo"
          className="w-9 h-9 rounded-xl object-cover shadow-lg shadow-sky-500/25 border border-sky-500/30"
          onError={(e) => {
            // fallback if path issues
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <div>
          <h1 className="font-extrabold text-slate-100 tracking-tight text-base leading-none uppercase">VANYA</h1>
          <span className="text-[11px] text-sky-400 font-bold uppercase tracking-wider">DOWNLOADER</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-sky-600/15 text-sky-400 border border-sky-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    isActive ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Free Software Footer */}
      <div className="p-4 m-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center gap-2.5 text-xs text-slate-400">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
        <div>
          <p className="font-semibold text-slate-200">100% Free Forever</p>
          <p className="text-[11px] text-slate-400">No Ads • No Subscription</p>
        </div>
      </div>
    </aside>
  );
};
