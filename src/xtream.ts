import type { Channel } from './m3u';

/** Xtream Codes API: the login most IPTV subscriptions use (server + username + password). */
export type XtreamLogin = { server: string; username: string; password: string };

export type Account = {
  username: string;
  status?: string;
  expDate: number | null;
  maxConnections?: string;
  activeConnections?: string;
  isTrial?: boolean;
};

export type Season = { season: string; episodes: Channel[] };

const enc = encodeURIComponent;
const asList = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Accepts "host:port", "http://host:port/", or a pasted player_api/get.php link. */
export function normalizeServer(input: string): string {
  let s = input.trim().replace(/\/(player_api|get)\.php.*$/i, '').replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  return s;
}

export async function api<T>(l: XtreamLogin, params: Record<string, string> = {}): Promise<T> {
  const query = Object.entries({ username: l.username, password: l.password, ...params })
    .map(([k, v]) => `${enc(k)}=${enc(v)}`)
    .join('&');
  let res: Response;
  try {
    res = await fetch(`${l.server}/player_api.php?${query}`);
  } catch {
    throw new Error("Can't reach the server. Check the server address and your internet.");
  }
  if (!res.ok) throw new Error(`Server error (${res.status})`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error("The server didn't answer like an IPTV (Xtream) server. Check the address.");
  }
}

type UserInfo = {
  auth?: number | string;
  username?: string;
  status?: string;
  exp_date?: string | null;
  max_connections?: string;
  active_cons?: string;
  is_trial?: string;
};

export async function login(l: XtreamLogin): Promise<Account> {
  const data = await api<{ user_info?: UserInfo }>(l);
  const u = data?.user_info;
  if (!u || Number(u.auth) !== 1) throw new Error('Login failed. Check your username and password.');
  if (u.status && u.status !== 'Active') throw new Error(`Your subscription is ${u.status}.`);
  return {
    username: u.username ?? l.username,
    status: u.status,
    expDate: u.exp_date ? Number(u.exp_date) : null,
    maxConnections: u.max_connections,
    activeConnections: u.active_cons,
    isTrial: u.is_trial === '1',
  };
}

type Category = { category_id: string | number; category_name: string };

async function categories(l: XtreamLogin, action: string): Promise<Map<string, string>> {
  const cats = asList<Category>(await api(l, { action }));
  return new Map(cats.map((c) => [String(c.category_id), c.category_name?.trim() || 'Other']));
}

/** Sort items so they follow the provider's category order. */
function byCategoryOrder(items: Channel[], cats: Map<string, string>): Channel[] {
  const order = new Map(Array.from(cats.values()).map((name, i) => [name, i]));
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => (order.get(a.item.group) ?? 1e9) - (order.get(b.item.group) ?? 1e9) || a.i - b.i)
    .map((x) => x.item);
}

const base = (l: XtreamLogin, type: string) => `${l.server}/${type}/${enc(l.username)}/${enc(l.password)}`;

type LiveStream = {
  stream_id: number;
  name?: string;
  stream_icon?: string;
  category_id?: string | null;
  tv_archive?: number | string;
  tv_archive_duration?: number | string;
};

export async function getLive(l: XtreamLogin): Promise<Channel[]> {
  const [cats, streams] = await Promise.all([
    categories(l, 'get_live_categories'),
    api<unknown>(l, { action: 'get_live_streams' }),
  ]);
  const items = asList<LiveStream>(streams).map<Channel>((s) => ({
    id: `live-${s.stream_id}`,
    name: s.name?.trim() || 'Untitled',
    logo: s.stream_icon || undefined,
    group: cats.get(String(s.category_id)) ?? 'Other',
    url: `${base(l, 'live')}/${s.stream_id}.m3u8`,
    fallbackUrl: `${base(l, 'live')}/${s.stream_id}.ts`,
    kind: 'live',
    streamId: s.stream_id,
    archiveDays: Number(s.tv_archive) === 1 ? Number(s.tv_archive_duration) || 1 : 0,
  }));
  return byCategoryOrder(items, cats);
}

type VodStream = {
  stream_id: number;
  name?: string;
  stream_icon?: string;
  category_id?: string | null;
  container_extension?: string;
  rating?: string | number;
};

export async function getMovies(l: XtreamLogin): Promise<Channel[]> {
  const [cats, streams] = await Promise.all([
    categories(l, 'get_vod_categories'),
    api<unknown>(l, { action: 'get_vod_streams' }),
  ]);
  const items = asList<VodStream>(streams).map<Channel>((s) => ({
    id: `movie-${s.stream_id}`,
    name: s.name?.trim() || 'Untitled',
    logo: s.stream_icon || undefined,
    group: cats.get(String(s.category_id)) ?? 'Other',
    url: `${base(l, 'movie')}/${s.stream_id}.${s.container_extension || 'mp4'}`,
    kind: 'movie',
    rating: s.rating ? String(s.rating) : undefined,
  }));
  return byCategoryOrder(items, cats);
}

type SeriesItem = { series_id: number; name?: string; cover?: string; category_id?: string | null; rating?: string };

export async function getSeries(l: XtreamLogin): Promise<Channel[]> {
  const [cats, list] = await Promise.all([
    categories(l, 'get_series_categories'),
    api<unknown>(l, { action: 'get_series' }),
  ]);
  const items = asList<SeriesItem>(list).map<Channel>((s) => ({
    id: `series-${s.series_id}`,
    name: s.name?.trim() || 'Untitled',
    logo: s.cover || undefined,
    group: cats.get(String(s.category_id)) ?? 'Other',
    url: '',
    kind: 'series',
    seriesId: String(s.series_id),
    rating: s.rating || undefined,
  }));
  return byCategoryOrder(items, cats);
}

type Episode = {
  id: string | number;
  title?: string;
  episode_num?: number | string;
  container_extension?: string;
  info?: { movie_image?: string };
};

export async function getEpisodes(l: XtreamLogin, series: Channel): Promise<Season[]> {
  const data = await api<{ episodes?: Record<string, Episode[]> | Episode[][] }>(l, {
    action: 'get_series_info',
    series_id: series.seriesId ?? '',
  });
  const raw = data?.episodes ?? {};
  const entries: [string, Episode[]][] = Array.isArray(raw)
    ? raw.map((eps, i) => [String(i + 1), eps])
    : Object.entries(raw);
  return entries
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([season, eps]) => ({
      season,
      episodes: asList<Episode>(eps).map<Channel>((e) => ({
        id: `ep-${e.id}`,
        name: e.title?.trim() || `Episode ${e.episode_num ?? ''}`.trim(),
        logo: e.info?.movie_image || series.logo,
        group: `${series.name} · Season ${season}`,
        url: `${base(l, 'series')}/${e.id}.${e.container_extension || 'mp4'}`,
        kind: 'episode',
      })),
    }))
    .filter((s) => s.episodes.length);
}
