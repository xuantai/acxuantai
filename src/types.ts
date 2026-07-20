export interface ReleasedSong {
  id: string;
  title: string;
  youtubeUrl: string;
}

export interface Playlist {
  id: string;
  title: string;
  songIds?: string[];
}

export interface Achievement {
  type: 'youtube_trending' | 'tiktok_viral' | 'spotify_streams' | 'youtube_views' | 'zing_streams';
  value: string;
}

export interface DemoSong {
  id: string;
  slug: string;
  title: string;
  author: string;
  composer?: string;
  singer?: string;
  audioUrl: string;
  coverUrl?: string;
  globalCoverUrl?: string;
  backgroundUrl?: string;
  lyrics: string;
  template: string;
  status: 'public' | 'hidden';
  password?: boolean; // From public API
  passwordValue?: string; // From admin API
  requiresPassword?: boolean;
  isReleased?: boolean;
  playlistIds?: string[];
  createdAt: number;
  secretKey?: string;
  achievements?: Achievement[];
}

export interface TemplateConfig {
  id: string;
  name: string;
  order: number;
  bgColor?: string;
  titleColor?: string;
  lyricsColor?: string;
  waveColor?: string;
}

export interface AppData {
  pageTitle?: string;
  artistName: string;
  artistBio: string;
  homeCoverUrl?: string;
  faviconUrl?: string;
  ogImageUrl?: string;
  youtubePlaylistUrl?: string;
  spotifyUrl?: string;
  socialFacebook?: string;
  socialInstagram?: string;
  socialYoutube?: string;
  socialTiktok?: string;
  globalPassword?: string;
  globalBaseUrl?: string;
  slideshowImages?: string[];
  releasedSongs: ReleasedSong[];
  demos: DemoSong[];
  playlists?: Playlist[];
  adminPassword?: string;
  memberPassword?: string;
  templateConfigs?: TemplateConfig[];
}
