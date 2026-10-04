import { create } from 'zustand';
import { DownloadItem, DownloadStats, Category } from '@shared/types/download';

interface DownloadStore {
  downloads: DownloadItem[];
  stats: DownloadStats | null;
  activeTab: 'downloads' | 'queue' | 'completed' | 'video' | 'history' | 'scheduler' | 'settings' | 'about';
  filterStatus: string;
  filterCategory: Category;
  searchQuery: string;
  sortBy: 'newest' | 'oldest' | 'name' | 'size' | 'speed';
  newDownloadModalOpen: boolean;
  initialUrlForModal: string;
  detectedClipboardUrl: string | null;
  videoModalOpen: boolean;
  videoModalUrl: string;
  videoModalMediaType: 'video' | 'audio';
  videoModalQuality: string;
  videoModalAutoStart: boolean;
  activeProgressModalIds: string[];

  setDownloads: (downloads: DownloadItem[]) => void;
  updateDownloadItem: (item: DownloadItem) => void;
  removeDownload: (id: string) => void;
  setStats: (stats: DownloadStats) => void;
  setActiveTab: (tab: any) => void;
  setFilterStatus: (status: string) => void;
  setFilterCategory: (category: Category) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: any) => void;
  openNewDownloadModal: (initialUrl?: string) => void;
  closeNewDownloadModal: () => void;
  openVideoModal: (
    url: string,
    mediaType?: 'video' | 'audio',
    quality?: string,
    autoStart?: boolean
  ) => void;
  closeVideoModal: () => void;
  openProgressModal: (id: string) => void;
  closeProgressModal: (id: string) => void;
  closeAllProgressModals: () => void;
  setDetectedClipboardUrl: (url: string | null) => void;
}

export const useDownloadStore = create<DownloadStore>((set) => ({
  downloads: [],
  stats: null,
  activeTab: 'downloads',
  filterStatus: 'All',
  filterCategory: 'All',
  searchQuery: '',
  sortBy: 'newest',
  newDownloadModalOpen: false,
  initialUrlForModal: '',
  detectedClipboardUrl: null,
  videoModalOpen: false,
  videoModalUrl: '',
  videoModalMediaType: 'video',
  videoModalQuality: '',
  videoModalAutoStart: false,
  activeProgressModalIds: [],

  setDownloads: (downloads) => set({ downloads }),
  removeDownload: (id) =>
    set((state) => ({
      downloads: state.downloads.filter((d) => d.id !== id),
    })),
  updateDownloadItem: (item) =>
    set((state) => {
      const index = state.downloads.findIndex((d) => d.id === item.id);
      if (index >= 0) {
        const next = [...state.downloads];
        next[index] = item;
        return { downloads: next };
      }
      return { downloads: [item, ...state.downloads] };
    }),
  setStats: (stats) => set({ stats }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setFilterStatus: (filterStatus) => set({ filterStatus }),
  setFilterCategory: (filterCategory) => set({ filterCategory }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSortBy: (sortBy) => set({ sortBy }),
  openNewDownloadModal: (initialUrl = '') => set({ newDownloadModalOpen: true, initialUrlForModal: initialUrl }),
  closeNewDownloadModal: () => set({ newDownloadModalOpen: false, initialUrlForModal: '' }),
  openVideoModal: (url, mediaType = 'video', quality = '', autoStart = false) =>
    set({
      videoModalOpen: true,
      videoModalUrl: url,
      videoModalMediaType: mediaType,
      videoModalQuality: quality,
      videoModalAutoStart: autoStart,
    }),
  closeVideoModal: () =>
    set({
      videoModalOpen: false,
      videoModalUrl: '',
      videoModalMediaType: 'video',
      videoModalQuality: '',
      videoModalAutoStart: false,
    }),
  openProgressModal: (id) =>
    set((state) => ({
      activeProgressModalIds: state.activeProgressModalIds.includes(id)
        ? state.activeProgressModalIds
        : [...state.activeProgressModalIds, id],
    })),
  closeProgressModal: (id) =>
    set((state) => ({
      activeProgressModalIds: state.activeProgressModalIds.filter((mId) => mId !== id),
    })),
  closeAllProgressModals: () => set({ activeProgressModalIds: [] }),
  setDetectedClipboardUrl: (url) => set({ detectedClipboardUrl: url }),
}));
