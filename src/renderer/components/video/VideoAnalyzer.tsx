import React, { useState } from 'react';
import { Search, Video, Music, ShieldAlert, Loader2, Download, CheckCircle2, Headphones } from 'lucide-react';
import { VideoMetadata, VideoFormat } from '@shared/types/video';
import { formatBytes, formatEta } from '@shared/constants/categories';
import { useDownloadStore } from '../../stores/useDownloadStore';

export const VideoAnalyzer: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'video' | 'audio'>('video');
  const [selectedFormat, setSelectedFormat] = useState<VideoFormat | null>(null);

  const { setActiveTab: setStoreActiveTab } = useDownloadStore();

  const handleAnalyze = async () => {
    if (!url) return;
    setLoading(true);
    setErrorMsg('');
    setMetadata(null);
    setSelectedFormat(null);

    try {
      const info = await window.electronAPI.analyzeVideoUrl(url);
      setMetadata(info);

      const isAudioOnlySource = info.videoFormats.length === 0 && info.audioFormats.length > 0;
      if (isAudioOnlySource) {
        setActiveTab('audio');
        setSelectedFormat(info.audioFormats[0] || null);
      } else {
        setActiveTab('video');
        setSelectedFormat(info.videoFormats[0] || info.audioFormats[0] || null);
      }
    } catch (err: any) {
      setErrorMsg(
        err.message ||
          'Unable to analyze this URL. The website may have changed its format or may not support direct downloading.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStartDownload = async () => {
    if (!metadata || !selectedFormat) return;

    try {
      const isAudio = activeTab === 'audio';
      const cleanTitle = metadata.title.replace(/[\/\\:*?"<>|]/g, '_');
      const ext = selectedFormat.extension || (isAudio ? 'mp3' : 'mp4');

      await window.electronAPI.addDownload({
        url: metadata.url,
        filename: `${cleanTitle}.${ext}`,
        startImmediately: true,
        sourceType: 'VIDEO',
        videoFormatId: selectedFormat.formatId,
        category: isAudio ? 'Music' : 'Videos',
      });

      setStoreActiveTab('downloads');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initiate media download');
    }
  };

  const currentFormats =
    activeTab === 'video'
      ? metadata?.videoFormats || []
      : metadata?.audioFormats || [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
          <Video className="w-6 h-6 text-sky-400" />
          <span>Supported Video & Audio Stream Extractor</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Paste supported media page URLs to extract direct video or audio streams and download cleanly.
        </p>
      </div>

      {/* Responsible Use Notice */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-300">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <p>
          Supported formats and websites may change. Only download content you have permission to save and that the
          source permits downloading. This application does not bypass DRM, paywalls, or technical protection systems.
        </p>
      </div>

      {/* URL Input Bar */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl space-y-3">
        <div className="flex gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste supported media URL here (e.g., https://...)..."
            className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !url}
            className="px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-sky-500/20 transition-all"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            <span>Analyze</span>
          </button>
        </div>

        {errorMsg && (
          <p className="text-xs text-rose-400 font-medium pl-1">{errorMsg}</p>
        )}
      </div>

      {/* Analysis Results Display */}
      {metadata && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6 animate-fade-in">
          {/* Metadata Card */}
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {metadata.thumbnail ? (
              <img
                src={metadata.thumbnail}
                alt={metadata.title}
                className="w-full sm:w-56 h-36 object-cover rounded-xl border border-slate-700/60 shadow-md shrink-0"
              />
            ) : (
              <div className="w-full sm:w-56 h-36 bg-slate-950 rounded-xl flex items-center justify-center border border-slate-800 shrink-0">
                {activeTab === 'video' ? (
                  <Video className="w-10 h-10 text-slate-600" />
                ) : (
                  <Music className="w-10 h-10 text-slate-600" />
                )}
              </div>
            )}

            <div className="space-y-2 min-w-0 flex-1">
              <h3 className="text-base font-bold text-slate-100 leading-snug line-clamp-2">{metadata.title}</h3>
              <div className="flex flex-wrap gap-4 text-xs text-slate-400 font-medium">
                {metadata.duration && <span>Duration: {formatEta(metadata.duration)}</span>}
                {metadata.uploader && <span>Uploader: {metadata.uploader}</span>}
                {metadata.site && <span>Platform: {metadata.site}</span>}
              </div>
            </div>
          </div>

          {/* IDM Stream Mode Switcher: Video Streams vs Audio Streams */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setActiveTab('video');
                if (metadata.videoFormats.length > 0) {
                  setSelectedFormat(metadata.videoFormats[0]);
                }
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                activeTab === 'video'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>🎬 Video Streams ({metadata.videoFormats.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('audio');
                if (metadata.audioFormats.length > 0) {
                  setSelectedFormat(metadata.audioFormats[0]);
                }
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                activeTab === 'audio'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Headphones className="w-4 h-4" />
              <span>🎵 Audio Streams / MP3 ({metadata.audioFormats.length})</span>
            </button>
          </div>

          {/* Formats Selection Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider px-1">
              <span>{activeTab === 'video' ? '🎬 Video Resolutions' : '🎵 Audio Bitrates'}</span>
              <span>Estimated Size</span>
            </div>

            <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800/60 bg-slate-950">
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
                    className={`p-3 flex items-center justify-between cursor-pointer text-xs transition-colors ${
                      isSelected
                        ? activeTab === 'video'
                          ? 'bg-sky-600/15 text-sky-300'
                          : 'bg-purple-600/15 text-purple-300'
                        : 'hover:bg-slate-900/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isSelected ? (
                        <CheckCircle2
                          className={`w-4 h-4 ${activeTab === 'video' ? 'text-sky-400' : 'text-purple-400'}`}
                        />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-700" />
                      )}
                      <div>
                        <span className="font-semibold text-slate-100">{format.qualityLabel || format.resolution}</span>
                        <span className="text-slate-500 ml-2">({format.extension.toUpperCase()})</span>
                        {format.bitrate && (
                          <span className="text-emerald-400 text-[11px] ml-2 font-mono">{format.bitrate}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-slate-400 font-mono">
                      <span>{format.resolution || (activeTab === 'audio' ? 'Audio Stream' : 'Video')}</span>
                      <span className="font-bold text-slate-200">{displaySize}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Start Download Button */}
          <div className="flex justify-end pt-2 border-t border-slate-800">
            <button
              onClick={handleStartDownload}
              disabled={!selectedFormat}
              className={`px-6 py-2.5 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all ${
                activeTab === 'audio'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 shadow-purple-500/20'
                  : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-sky-500/20'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Download {activeTab === 'audio' ? 'Selected Audio Track' : 'Selected Video Format'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
