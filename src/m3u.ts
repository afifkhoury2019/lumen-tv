export type Channel = {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group: string;
  headers?: Record<string, string>;
};

const attr = (line: string, key: string): string | undefined => {
  const m = line.match(new RegExp(`${key}="([^"]*)"`, 'i'));
  return m?.[1]?.trim() || undefined;
};

/** Parses an M3U / M3U8 playlist (the common IPTV format) into channels. */
export function parseM3U(text: string): Channel[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const channels: Channel[] = [];
  let pending: Partial<Channel> | null = null;
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
      channels.push({
        id: `${channels.length}-${line}`,
        name: pending.name!,
        url: line,
        logo: pending.logo,
        group: pending.group!,
        headers: Object.keys(headers).length ? headers : undefined,
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
