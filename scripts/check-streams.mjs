#!/usr/bin/env node
// Downloads one or more M3U playlists, tests every stream, and writes a playlist with only the working ones.
// Usage: node scripts/check-streams.mjs <source-url[,source-url...]> <output-file> [--min-ratio=0.5]
// Several sources are merged in order; a stream URL that appears twice is kept once.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [source, output, ...flags] = process.argv.slice(2);
if (!source || !output) {
  console.error('Usage: node scripts/check-streams.mjs <source-url> <output-file> [--min-ratio=0.5]');
  process.exit(2);
}
const minRatio = Number(flags.find((f) => f.startsWith('--min-ratio='))?.split('=')[1] ?? 0.5);
const UA = 'Mozilla/5.0 (Linux; Android 14) LumenTV';
const TIMEOUT_MS = 12000;
const CONCURRENCY = 40;

/** Split the playlist into entries, keeping every line that belongs to each one. */
function entries(text) {
  const out = [];
  let block = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#EXTM3U')) continue;
    if (line.startsWith('#EXTINF')) block = [line];
    else if (line.startsWith('#')) block.length && block.push(line);
    else if (block.length) {
      const headers = {};
      for (const l of block) {
        const m = l.match(/^#EXTVLCOPT:http-(user-agent|referr?er)=(.*)$/i);
        if (m) headers[/agent/i.test(m[1]) ? 'User-Agent' : 'Referer'] = m[2];
      }
      out.push({ lines: [...block, line], url: line, name: block[0].split(',').pop()?.trim(), headers });
      block = [];
    }
  }
  return out;
}

async function get(url, headers) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { 'User-Agent': UA, ...headers } });
    const reader = res.body?.getReader();
    let text = '';
    const dec = new TextDecoder();
    while (reader && text.length < 4096) {
      const { done, value } = await reader.read();
      if (done) break;
      text += dec.decode(value, { stream: true });
    }
    reader?.cancel().catch(() => {});
    return { ok: res.ok, status: res.status, url: res.url, text };
  } finally {
    clearTimeout(timer);
  }
}

/** A stream passes if it answers, and (for HLS) its first variant/segment answers too. */
async function works(entry) {
  try {
    const r = await get(entry.url, entry.headers);
    if (!r.ok || !r.text.length) return false;
    if (!r.text.trimStart().startsWith('#EXTM3U')) return true;
    const next = r.text.split(/\r?\n/).map((s) => s.trim()).find((s) => s && !s.startsWith('#'));
    if (!next) return true;
    return (await get(new URL(next, r.url).toString(), entry.headers)).ok;
  } catch {
    return false;
  }
}

const sources = source.split(',').map((s) => s.trim()).filter(Boolean);
const list = [];
const seen = new Set();
for (const src of sources) {
  const res = await fetch(src, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    // The first source is required; extra ones are skipped if they fail.
    if (src === sources[0]) throw new Error(`Source playlist failed: HTTP ${res.status}`);
    console.warn(`Skipping ${src}: HTTP ${res.status}`);
    continue;
  }
  for (const e of entries(await res.text())) {
    if (seen.has(e.url)) continue;
    seen.add(e.url);
    list.push(e);
  }
}

const ok = new Array(list.length).fill(false);
let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < list.length) {
      const i = next++;
      ok[i] = await works(list[i]);
    }
  }),
);

const working = list.filter((_, i) => ok[i]);
console.log(`Checked ${list.length} streams: ${working.length} working, ${list.length - working.length} broken.`);
for (const [i, e] of list.entries()) if (!ok[i]) console.log(`  broken: ${e.name}`);

// Guard against a network hiccup on the runner wiping out the list.
if (working.length < list.length * minRatio) {
  console.error(`Only ${working.length}/${list.length} worked (below ${minRatio * 100}%). Not writing the playlist.`);
  process.exit(1);
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(
  output,
  [`#EXTM3U`, ...sources.map((s) => `# Source: ${s}`), `# Checked ${new Date().toISOString()} - ${working.length}/${list.length} working`]
    .concat(working.flatMap((e) => e.lines))
    .join('\n') + '\n',
);
console.log(`Wrote ${output}`);
