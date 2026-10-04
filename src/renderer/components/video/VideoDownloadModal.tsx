import React, { useState, useEffect } from 'react';
import {
  X,
  Video,
  Music,
  Loader2,
  CheckCircle2,
  Folder,
  Download,
  Clock,
  AlertCircle,
  Sparkles,
  Layers,
  Headphones,
} from 'lucide-react';
import { useDownloadStore } from '../../stores/useDownloadStore';
import { VideoMetadata, VideoFormat } from '@shared/types/video';
import { formatBytes, formatEta } from '@shared/constants/categories';

export const VideoDownloadModal: React.FC = () => {
  const {
    videoModalOpen,
    videoModalUrl,
    videoModalMediaType,
    videoModalQuality,
    videoModalAutoStart,
    closeVideoModal,
    openProgressModal,
  } = useDownloadStore();

  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [activeMediaType, setActiveMediaType] = useState<'video' | 'audio'>('video');
  const [selectedFormat, setSelectedFormat] = useState<VideoFormat | null>(null);
  const [destinationDir, setDestinationDir] = useState('');
  const [customFilename, setCustomFilename] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (videoModalOpen && videoModalUrl) {
      setErrorMsg('');
      setMetadata(null);
      setSelectedFormat(null);
      setCustomFilename('');
      setActiveMediaType(videoModalMediaType || 'video');

      // Fetch default download dir
      window.electronAPI.getSettings().then((s) => {
        setDestinationDir(s.defaultDownloadDir);
      });

      handleAnalyze(videoModalUrl, videoModalMediaType, videoModalQuality, videoModalAutoStart);
    }
  }, [videoModalOpen, videoModalUrl, videoModalMediaType, videoModalQuality, videoModalAutoStart]);

  const handleAnalyze = async (
    targetUrl: string,
    reqType: 'video' | 'audio' = 'video',
    reqQuality: string = '',
    autoStart: boolean = false
  ) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await window.electronAPI.analyzeVideoUrl(targetUrl);
      setMetadata(data);
      setCustomFilename(data.title.replace(/[\/\\:*?"<>|]/g, '_'));

      let chosenFormat: VideoFormat | null = null;
      const isAudioReq = reqType === 'audio' || (data.videoFormats.length === 0 && data.audioFormats.length > 0);

      if (isAudioReq) {
        setActiveMediaType('audio');
        if (reqQuality) {
          chosenFormat =
            data.audioFormats.find(
              (f) =>
                f.quality?.toLowerCase().includes(reqQuality.toLowerCase()) ||
                f.resolution?.toLowerCase().includes(reqQuality.toLowerCase())
            ) || data.audioFormats[0];
        } else {
          chosenFormat = data.audioFormats[0] || null;
        }
      } else {
        setActiveMediaType('video');
        if (reqQuality) {
          chosenFormat =
            data.videoFormats.find(
              (f) =>
                f.resolution?.toLowerCase().includes(reqQuality.toLowerCase()) ||
                f.quality?.toLowerCase().includes(reqQuality.toLowerCase())
            ) ||
            data.videoFormats.find((f) => f.resolution?.includes('1080')) ||
            data.videoFormats[0];
        } else {
          chosenFormat =
            data.videoFormats.find((f) => f.resolution?.includes('1080')) ||
            data.videoFormats.find((f) => f.resolution?.includes('720')) ||
            data.videoFormats[0] ||
            null;
        }
      }

      setSelectedFormat(chosenFormat);

      // If auto-start was clicked directly from the in-browser dropdown
      if (autoStart && chosenFormat) {
        const ext = chosenFormat.extension || (isAudioReq ? 'mp3' : 'mp4');
        const cleanTitle = data.title.replace(/[\/\\:*?"<>|]/g, '_');
        const baseName = cleanTitle.replace(/\.[^/.]+$/, '');
        const finalName = `${baseName}.${ext}`;

        const item = await window.electronAPI.addDownload({
          url: data.url,
          filename: finalName,
          startImmediately: true,
          sourceType: 'VIDEO',
          videoFormatId: chosenFormat.formatId,
          category: isAudioReq ? 'Music' : 'Videos',
        });

        closeVideoModal();
        if (item?.id) {
          openProgressModal(item.id);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to extract media streams. Please check URL or network.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDir = async () => {
    const dir = await window.electronAPI.selectDirectory();
    if (dir) {
      setDestinationDir(dir);
    }
  };

  const handleStartDownload = async (startImmediately: boolean = true) => {
    if (!metadata || !selectedFormat) return;

    try {
      const ext = selectedFormat.extension || (activeMediaType === 'audio' ? 'mp3' : 'mp4');
      const baseName = customFilename.replace(/\.[^/.]+$/, '');
      const finalName = `${baseName}.${ext}`;

      const item = await window.electronAPI.addDownload({
        url: metadata.url,
        filename: finalName,
        destinationDir: destinationDir || undefined,
        startImmediately,
        sourceType: 'VIDEO',
        videoFormatId: selectedFormat.formatId,
        category: activeMediaType === 'audio' ? 'Music' : 'Videos',
      });

      closeVideoModal();

      if (startImmediately && item?.id) {
        openProgressModal(item.id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start media download.');
    }
  };

  if (!videoModalOpen) return null;

  const currentFormats =
    activeMediaType === 'video'
      ? metadata?.videoFormats || []
      : metadata?.audioFormats || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col space-y-4 p-6 max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-500/20 to-blue-600/20 border border-sky-500/30 text-sky-400">
              {activeMediaType === 'video' ? <Video className="w-5 h-5" /> : <Music className="w-5 h-5 text-purple-400" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>VANYA Media Stream Downloader</span>
                <span className="text-[10px] bg-sky-500/15 border border-sky-500/30 text-sky-400 font-semibold px-2 py-0.5 rounded-full">
                  IDM Fast Mode
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Extract high-speed video streams or audio tracks</p>
            </div>
          </div>

          <button
            onClick={closeVideoModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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

        {/* Loading State */}
        {loading && (
          <div className="py-14 flex flex-col items-center justify-center space-y-3">
            <div className="relative">
              <Loader2 className="w-10 h-10 text-sky-400 animate-spin" />
              <Sparkles className="w-4 h-4 text-amber-400 absolute -top-1 -right-1 animate-bounce" />
            </div>
            <p className="text-xs font-bold text-slate-200">Analyzing Video & Audio Streams...</p>
            <p className="text-[11px] text-slate-500 max-w-sm text-center truncate">{videoModalUrl}</p>
          </div>
        )}

        {/* Loaded Media Content */}
        {!loading && metadata && (
          <div className="space-y-4 overflow-y-auto pr-1">
            {/* Media Overview Card */}
            <div className="flex gap-4 p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl items-start">
              {metadata.thumbnail ? (
                <img
                  src={metadata.thumbnail}
                  alt={metadata.title}
                  className="w-36 h-22 object-cover rounded-xl border border-slate-700/60 shadow shrink-0"
                />
              ) : (
                <div className="w-36 h-22 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-800 shrink-0">
                  <Video className="w-6 h-6 text-slate-600" />
                </div>
              )}

              <div className="space-y-1.5 min-w-0 flex-1">
                <h3 className="text-xs font-bold text-slate-100 line-clamp-2 leading-snug">{metadata.title}</h3>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                  {metadata.duration && (
                    <span className="flex items-center gap-1 font-medium text-slate-300">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {formatEta(metadata.duration)}
                    </span>
                  )}
                  {metadata.uploader && <span>By {metadata.uploader}</span>}
                  {metadata.site && <span className="text-sky-400 font-semibold">{metadata.site}</span>}
                </div>
              </div>
            </div>

            {/* Media Type Switcher: Video vs Audio Songs */}
            <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                onClick={() => {
                  setActiveMediaType('video');
                  if (metadata.videoFormats.length > 0) {
                    setSelectedFormat(metadata.videoFormats[0]);
                  }
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                  activeMediaType === 'video'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>🎬 Video Formats ({metadata.videoFormats.length})</span>
              </button>

              <button
                onClick={() => {
                  setActiveMediaType('audio');
                  if (metadata.audioFormats.length > 0) {
                    setSelectedFormat(metadata.audioFormats[0]);
                  }
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                  activeMediaType === 'audio'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Headphones className="w-4 h-4" />
                <span>🎵 Audio / MP3 Songs ({metadata.audioFormats.length})</span>
              </button>
            </div>

            {/* Formats Grid / List */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium px-1">
                <span>Select Quality & Format</span>
                <span>Estimated Size</span>
              </div>

              <div className="max-h-44 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800/60 bg-slate-950">
                {currentFormats.map((format, idx) => {
                  const isSelected = selectedFormat?.formatId === format.formatId;
                  const displaySize = format.filesize
                    ? formatBytes(format.filesize)
                    : format.filesizeApprox
                    ? `~${formatBytes(format.filesizeApprox)}`
                    : 'Dynamic Stream';

                  return (
                    <div
                      key={format.formatId + '_' + idx}
                      onClick={() => setSelectedFormat(format)}
                      className={`p-2.5 px-3.5 flex items-center justify-between cursor-pointer text-xs transition-colors ${
                        isSelected
                          ? activeMediaType === 'video'
                            ? 'bg-sky-600/20 text-sky-300'
                            : 'bg-purple-600/20 text-purple-300'
                          : 'hover:bg-slate-900/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isSelected ? (
                          <CheckCircle2
                            className={`w-4 h-4 ${activeMediaType === 'video' ? 'text-sky-400' : 'text-purple-400'}`}
                          />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-700" />
                        )}
                        <div>
                          <span className="font-semibold text-slate-100">{format.qualityLabel || format.resolution}</span>
                          <span className="text-slate-500 text-[11px] ml-2">({format.extension.toUpperCase()})</span>
                          {format.bitrate && (
                            <span className="text-emerald-400 text-[10px] ml-2 font-mono">{format.bitrate}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono">
                        <span className="text-slate-400">{format.resolution || 'Audio'}</span>
                        <span className="font-bold text-slate-200">{displaySize}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Save Location & Filename */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">File Name</label>
                <input
                  type="text"
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Save Location</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={destinationDir}
                    className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 truncate"
                  />
                  <button
                    onClick={handleSelectDir}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center gap-1 shrink-0"
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>Browse</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            onClick={() => handleStartDownload(false)}
            disabled={!selectedFormat}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
          >
            START LATER
          </button>
          <button
            onClick={() => handleStartDownload(true)}
            disabled={!selectedFormat}
            className={`px-5 py-2 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition-all ${
              activeMediaType === 'audio'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 shadow-purple-500/20'
                : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-sky-500/20'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>START DOWNLOAD</span>
          </button>
        </div>
      </div>
    </div>
  );
};
