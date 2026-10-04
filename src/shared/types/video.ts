export interface VideoFormat {
  formatId: string;
  extension: string;
  resolution?: string; // e.g. 1080p, 720p, 480p, Audio Only
  fps?: number;
  filesize?: number;
  filesizeApprox?: number;
  vcodec?: string;
  acodec?: string;
  hasVideo: boolean;
  hasAudio: boolean;
  qualityLabel?: string;
  quality?: string;
  bitrate?: string;
  isAudioOnly?: boolean;
}

export interface VideoMetadata {
  url: string;
  title: string;
  thumbnail?: string;
  duration?: number; // seconds
  uploader?: string;
  site?: string;
  videoFormats: VideoFormat[];
  audioFormats: VideoFormat[];
  formats: VideoFormat[];
}

