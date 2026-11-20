import { useEffect, useState } from 'react';
import type { Channel } from './m3u';
import { api, type XtreamLogin } from './xtream';

/** One TV programme from the provider's guide (EPG). */
export type Programme = {
  id: string;
  title: string;
  description: string;
  /** Unix seconds. */
  start: number;
  stop: number;
  /** Server-local start time as sent ("YYYY-MM-DD HH:MM:SS"), needed for catch-up URLs. */
  startRaw: string;
  hasArchive: boolean;
};

// The guide is fetched with the signed-in subscription; App sets it on login and clears it on sign-out.
let login: XtreamLogin | null = null;
export function setEpgLogin(l: XtreamLogin | null) {
  login = l;
  nowNextCache.clear();
}

// ---- base64 + UTF-8 decoding (titles are base64; Arabic needs proper UTF-8) ----
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64ToBytes(s: string): number[] {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = [0, 1, 2, 3].map((k) => B64.indexOf(clean[i + k] ?? 'A'));
    const v = (n[0] << 18) | (n[1] << 12) | (n[2] << 6) | n[3];
    out.push((v >> 16) & 255);
    if (i + 2 < clean.length) out.push((v >> 8) & 255);
    if (i + 3 < clean.length) out.push(v & 255);
  }
  return out;
}
function utf8(bytes: number[]): string {
  let s = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++];
    let cp = b;
    if (b >= 0xf0) cp = ((b & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
    else if (b >= 0xe0) cp = ((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
    else if (b >= 0xc0) cp = ((b & 31) << 6) | (bytes[i++] & 63);
    s += String.fromCodePoint(cp);
  }
  return s;
}
/** Providers send titles base64-encoded; some send plain text. */
export function decodeText(v: unknown): string {
  if (typeof v !== 'string' || !v) return '';
  if (!/^[A-Za-z0-9+/]+=*$/.test(v) || v.length % 4 !== 0) return v.trim();
  try {
    return utf8(b64ToBytes(v)).trim();
  } catch {
    return v.trim();
  }
}

type RawListing = {
  id?: string | number;
  title?: string;
  description?: string;
  start?: string;
  start_timestamp?: string | number;
  stop_timestamp?: string | number;
  has_archive?: string | number;
};

function toProgrammes(raw: unknown): Programme[] {
  const list = (raw as { epg_listings?: RawListing[] })?.epg_listings;
  if (!Array.isArray(list)) return [];
  return list
    .map((p, i) => ({
      id: String(p.id ?? i),
      title: decodeText(p.title) || 'No title',
      description: decodeText(p.description),
      start: Number(p.start_timestamp) || 0,
      stop: Number(p.stop_timestamp) || 0,
      startRaw: p.start ?? '',
      hasArchive: Number(p.has_archive) === 1,
    }))
    .filter((p) => p.start && p.stop > p.start)
    .sort((a, b) => a.start - b.start);
}

/** The full guide the provider has for one channel (past days with archive + upcoming). */
export async function getGuide(channel: Channel): Promise<Programme[]> {
  if (!login || !channel.streamId) return [];
  return toProgrammes(await api(login, { action: 'get_simple_data_table', stream_id: String(channel.streamId) }));
}

// ---- now / next for channel list rows, cached and fetched a few at a time ----
type NowNext = { now?: Programme; next?: Programme };
const nowNextCache = new Map<number, { data: NowNext; expires: number }>();
const queue: (() => Promise<void>)[] = [];
let running = 0;
function enqueue(job: () => Promise<void>) {
  queue.push(job);
  pump();
}
function pump() {
  while (running < 4 && queue.length) {
    const job = queue.shift()!;
    running++;
    job().finally(() => {
      running--;
      pump();
    });
  }
}

export function useNowNext(channel: Channel): NowNext {
  const id = channel.streamId;
  const [data, setData] = useState<NowNext>(() => (id ? nowNextCache.get(id)?.data ?? {} : {}));

  useEffect(() => {
    if (!id || !login) return;
    const hit = nowNextCache.get(id);
    if (hit && hit.expires > Date.now()) {
      setData(hit.data);
      return;
    }
    let alive = true;
    enqueue(async () => {
      if (!alive || !login) return;
      try {
        const progs = toProgrammes(await api(login, { action: 'get_short_epg', stream_id: String(id), limit: '3' }));
        const t = Date.now() / 1000;
        const i = progs.findIndex((p) => p.start <= t && t < p.stop);
        const value: NowNext = i >= 0 ? { now: progs[i], next: progs[i + 1] } : { next: progs.find((p) => p.start > t) };
        const expires = (value.now?.stop ?? t + 600) * 1000;
        nowNextCache.set(id, { data: value, expires });
        if (alive) setData(value);
      } catch {
        nowNextCache.set(id, { data: {}, expires: Date.now() + 5 * 60_000 });
      }
    });
    return () => {
      alive = false;
    };
  }, [id]);

  return data;
}

/** Builds a playable catch-up item for a past programme. */
export function catchupItem(channel: Channel, p: Programme): Channel | null {
  if (!login || !channel.streamId || !p.startRaw) return null;
  // "2026-11-20 14:00:00" -> "2026-11-20:14-00" (server time, as the server expects)
  const m = p.startRaw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  const start = `${m[1]}:${m[2]}-${m[3]}`;
  const minutes = Math.max(1, Math.round((p.stop - p.start) / 60));
  const u = encodeURIComponent(login.username);
  const pw = encodeURIComponent(login.password);
  return {
    id: `catchup-${channel.streamId}-${p.start}`,
    name: p.title,
    group: channel.name,
    logo: channel.logo,
    url: `${login.server}/timeshift/${u}/${pw}/${minutes}/${start}/${channel.streamId}.ts`,
    fallbackUrl: `${login.server}/streaming/timeshift.php?username=${u}&password=${pw}&stream=${channel.streamId}&start=${start}&duration=${minutes}`,
    kind: 'catchup',
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
export const clock = (unix: number) => {
  const d = new Date(unix * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export function dayLabel(unix: number): string {
  const d = new Date(unix * 1000);
  const today = new Date();
  const diff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000,
  );
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
