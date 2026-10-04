import React, { useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { HeaderStats } from './components/layout/HeaderStats';
import { DownloadCard } from './components/downloads/DownloadCard';
import { NewDownloadModal } from './components/downloads/NewDownloadModal';
import { DownloadProgressModal } from './components/downloads/DownloadProgressModal';
import { VideoDownloadModal } from './components/video/VideoDownloadModal';
import { VideoAnalyzer } from './components/video/VideoAnalyzer';
import { SettingsView } from './components/settings/SettingsView';
import { SchedulerPanel } from './components/scheduler/SchedulerPanel';
import { HistoryTable } from './components/history/HistoryTable';
import { AboutView } from './components/about/AboutView';
import { useDownloadStore } from './stores/useDownloadStore';
import { SingleFloatingProgressView } from './components/downloads/SingleFloatingProgressView';
import { Search, Filter, ArrowUpDown, ClipboardCheck } from 'lucide-react';
import { Category } from '@shared/types/download';

export const App: React.FC = () => {
  // Check if this window was opened as an independent floating progress window
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  let isProgressModal = false;
  let progressDownloadId = '';

  if (hash.includes('progress?id=')) {
    isProgressModal = true;
    progressDownloadId = hash.split('id=')[1]?.split('&')[0] || '';
  } else if (search.includes('modal=progress')) {
    isProgressModal = true;
    const params = new URLSearchParams(search);
    progressDownloadId = params.get('id') || '';
  }

  if (isProgressModal && progressDownloadId) {
    return <SingleFloatingProgressView downloadId={progressDownloadId} />;
  }

  const {
    downloads,
    setDownloads,
    updateDownloadItem,
    setStats,
    activeTab,
    filterStatus,
    setFilterStatus,
    filterCategory,
    setFilterCategory,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    detectedClipboardUrl,
    setDetectedClipboardUrl,
    openNewDownloadModal,
    openVideoModal,
  } = useDownloadStore();

  useEffect(() => {
    // Initial fetch of downloads and stats
    if (window.electronAPI) {
      window.electronAPI.getDownloads().then(setDownloads).catch((err) => {
        console.error('Failed to fetch downloads:', err);
      });
      window.electronAPI.getStats().then(setStats).catch((err) => {
        console.error('Failed to fetch stats:', err);
      });

      // Event Subscriptions
      const unsubProgress = window.electronAPI.onDownloadProgress((item) => {
        updateDownloadItem(item);
      });

      const unsubState = window.electronAPI.onDownloadStateChange((item) => {
        updateDownloadItem(item);
        window.electronAPI.getStats().then(setStats).catch(() => {});
      });

      const unsubStats = window.electronAPI.onStatsUpdate((stats) => {
        setStats(stats);
      });

      const unsubClipboard = window.electronAPI.onClipboardUrlDetected((url) => {
        setDetectedClipboardUrl(url);
      });

      const unsubVideoPrompt = window.electronAPI.onOpenVideoPrompt?.((data: any) => {
        const targetUrl = typeof data === 'string' ? data : data?.url;
        const mediaType = typeof data === 'object' ? data?.type : 'video';
        const quality = typeof data === 'object' ? data?.quality : '';
        const startImmediately = typeof data === 'object' ? data?.startImmediately : false;
        if (targetUrl) {
          openVideoModal(targetUrl, mediaType, quality, startImmediately);
        }
      });

      const unsubDownloadPrompt = window.electronAPI.onOpenDownloadPrompt?.((data: any) => {
        const targetUrl = typeof data === 'string' ? data : data?.url;
        if (targetUrl) openNewDownloadModal(targetUrl);
      });

      return () => {
        if (typeof unsubProgress === 'function') unsubProgress();
        if (typeof unsubState === 'function') unsubState();
        if (typeof unsubStats === 'function') unsubStats();
        if (typeof unsubClipboard === 'function') unsubClipboard();
        if (typeof unsubVideoPrompt === 'function') unsubVideoPrompt();
        if (typeof unsubDownloadPrompt === 'function') unsubDownloadPrompt();
      };
    }
  }, []);

  // Filter downloads list
  const filteredDownloads = downloads.filter((item) => {
    // Tab filter
    if (activeTab === 'queue' && item.status !== 'QUEUED') return false;
    if (activeTab === 'completed' && item.status !== 'COMPLETED') return false;

    // Status filter
    if (filterStatus !== 'All' && item.status !== filterStatus) return false;

    // Category filter
    if (filterCategory !== 'All' && item.category !== filterCategory) return false;

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.filename.toLowerCase().includes(q) || item.url.toLowerCase().includes(q);
    }

    return true;
  });

  // Sort downloads
  const sortedDownloads = [...filteredDownloads].sort((a, b) => {
    if (sortBy === 'newest') return b.createdTime - a.createdTime;
    if (sortBy === 'oldest') return a.createdTime - b.createdTime;
    if (sortBy === 'name') return a.filename.localeCompare(b.filename);
    if (sortBy === 'size') return (b.totalSize || 0) - (a.totalSize || 0);
    if (sortBy === 'speed') return (b.speed || 0) - (a.speed || 0);
    return 0;
  });

  const categories: Category[] = ['All', 'Videos', 'Music', 'Documents', 'Programs', 'Archives', 'Other'];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Content Workspace */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Dashboard */}
        <HeaderStats />

        {/* Clipboard URL Toast Notification */}
        {detectedClipboardUrl && (
          <div className="bg-sky-950/80 border-b border-sky-800/60 px-5 py-2.5 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2.5 text-xs text-sky-200 min-w-0">
              <ClipboardCheck className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="font-semibold text-slate-100">Downloadable URL detected:</span>
              <span className="truncate text-slate-300 max-w-lg">{detectedClipboardUrl}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  openNewDownloadModal(detectedClipboardUrl);
                  setDetectedClipboardUrl(null);
                }}
                className="px-3 py-1 bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                Download Now
              </button>
              <button
                onClick={() => setDetectedClipboardUrl(null)}
                className="px-2.5 py-1 text-slate-400 hover:text-white text-xs font-semibold"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* View Switcher */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'video' && <VideoAnalyzer />}
          {activeTab === 'scheduler' && <SchedulerPanel />}
          {activeTab === 'settings' && <SettingsView />}
          {activeTab === 'history' && <HistoryTable />}
          {activeTab === 'about' && <AboutView />}

          {(activeTab === 'downloads' || activeTab === 'queue' || activeTab === 'completed') && (
            <div className="p-5 space-y-4 max-w-6xl mx-auto">
              {/* Filter and Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search active & queued downloads..."
                    className="w-full pl-9 pr-3.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Status Tabs */}
                {activeTab === 'downloads' && (
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800/80 text-xs">
                    {['All', 'DOWNLOADING', 'QUEUED', 'PAUSED', 'COMPLETED', 'FAILED'].map((st) => (
                      <button
                        key={st}
                        onClick={() => setFilterStatus(st)}
                        className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                          filterStatus === st ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {st === 'DOWNLOADING' ? 'Active' : st}
                      </button>
                    ))}
                  </div>
                )}

                {/* Category Selector */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">Category:</span>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value as Category)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-slate-200 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Sort Selector */}
                <div className="flex items-center gap-2 text-xs">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-slate-200 focus:outline-none"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="name">Name</option>
                    <option value="size">Size</option>
                    <option value="speed">Speed</option>
                  </select>
                </div>
              </div>

              {/* Downloads Card List */}
              {sortedDownloads.length === 0 ? (
                <div className="p-16 text-center bg-slate-900/30 border border-slate-800/80 rounded-2xl space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto text-slate-500">
                    <Filter className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-300">No downloads matching criteria</p>
                  <p className="text-xs text-slate-500">Click "+ New Download" or paste a URL to start downloading.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedDownloads.map((item) => (
                    <DownloadCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Global Modals */}
      <NewDownloadModal />
      <VideoDownloadModal />
      <DownloadProgressModal />
    </div>
  );
};
