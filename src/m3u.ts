export type Channel = {
  id: string;
  name: string;
  url: string;
  /** Tried automatically if `url` fails to play (e.g. .ts instead of .m3u8). */
  fallbackUrl?: string;
  logo?: string;
  group: string;
  headers?: Record<string, string>;
  kind: 'live' | 'movie' | 'series' | 'episode';
  /** Xtream series id, for kind === 'series'. */
  seriesId?: string;
  rating?: string;
};

/** Small stable hash so ids don't contain stream URLs (which may hold credentials). */
export function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const attr = (line: string, key: string): string | undefined => {
  const m = line.match(new RegExp(`${key}="([^"]*)"`, 'i'));
  return m?.[1]?.trim() || undefined;
};

/** Parses an M3U / M3U8 playlist (the common IPTV format) into channels. */
export function parseM3U(text: string): Channel[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const channels: Channel[] = [];
  const seen = new Set<string>();
  let pending: { name: string; logo?: string; group: string } | null = null;
  let headers: Record<string, string> = {};

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const comma = line.lastIndexOf(',');
      pending = {
        name: (comma >= 0 ? line.slice(comma + 1) : '').trim() || attr(line, 'tvg-name') || 'Untitled',
        logo: attr(line, 'tvg-logo'),
        group: attr(line, 'group-title') || 'Other',
      };
      headers = {};
    } else if (line.startsWith('#EXTGRP:') && pending) {
      pending.group = line.slice(8).trim() || pending.group;
    } else if (line.startsWith('#EXTVLCOPT:')) {
      const [k, ...v] = line.slice(11).split('=');
      const value = v.join('=');
      if (/http-user-agent/i.test(k)) headers['User-Agent'] = value;
      if (/http-referr?er/i.test(k)) headers['Referer'] = value;
    } else if (!line.startsWith('#') && pending) {
      let id = `m3u-${hash(line)}`;
      while (seen.has(id)) id += '_';
      seen.add(id);
      const isVod = /\/(movie|series)\//i.test(line) || /\.(mp4|mkv|avi)(\?|$)/i.test(line);
      channels.push({
        id,
        name: pending.name,
        url: line,
        logo: pending.logo,
        group: pending.group,
        headers: Object.keys(headers).length ? headers : undefined,
        kind: isVod ? 'movie' : 'live',
      });
      pending = null;
    }
  }
  return channels;
}

export async function loadPlaylist(url: string): Promise<Channel[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Playlist request failed (${res.status})`);
  const channels = parseM3U(await res.text());
  if (!channels.length) throw new Error('No channels found. Is this an M3U playlist?');
  return channels;
}
