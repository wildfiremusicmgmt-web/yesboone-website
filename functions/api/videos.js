/**
 * Yes Boone - latest YouTube videos
 * Cloudflare Pages Function, served at:  /api/videos
 *
 * Reads the public YouTube uploads feed for @yesboone on Cloudflare's side
 * (a browser can't read that feed directly), skips Shorts, and returns the
 * newest videos as JSON, newest first:
 *
 *   { "videos": [ { "id": "...", "title": "...", "published": "..." } ],
 *     "updated": "2026-10-30T00:00:00.000Z" }
 *
 * - Re-checks YouTube at most every 30 minutes.
 * - If YouTube's feed is down, serves the last good list (kept for 7 days).
 * - If there's nothing to serve, returns an error and the website simply
 *   keeps the videos already written into index.html.
 */

const CHANNEL_ID = 'UCt0bc5uqdaC0bcihYZZbytw'; // youtube.com/@yesboone
const MAX_VIDEOS = 5;   // one per video card on the site
const HIDE_IDS = [];    // video IDs to never show, e.g. ['abcdefghijk']

const FRESH_SECONDS = 30 * 60;            // how often to re-check YouTube
const BACKUP_SECONDS = 7 * 24 * 60 * 60;  // how long to keep the last good list
const BROWSER_SECONDS = 5 * 60;           // how long a visitor's browser reuses it

// YouTube only lists the latest 15 uploads per feed. The first feed is the
// channel's videos-only list (no Shorts); the second (all uploads) is a backup.
const FEEDS = [
  'https://www.youtube.com/feeds/videos.xml?playlist_id=UULF' + CHANNEL_ID.slice(2),
  'https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL_ID,
];

export async function onRequestGet(context) {
  const origin = new URL(context.request.url).origin;
  const freshKey = new Request(origin + '/api/videos?cache=fresh');
  const backupKey = new Request(origin + '/api/videos?cache=backup');
  const cache = typeof caches !== 'undefined' ? caches.default : null;

  // 1. Recent copy in Cloudflare's cache? Use it.
  const cached = cache ? await cache.match(freshKey).catch(() => null) : null;
  if (cached) return json(await cached.text(), 200, 'public, max-age=' + BROWSER_SECONDS);

  // 2. Otherwise ask YouTube.
  try {
    const videos = await loadVideos();
    const body = JSON.stringify({ videos, updated: new Date().toISOString() });
    if (cache) {
      context.waitUntil(
        Promise.all([
          cache.put(freshKey, json(body, 200, 'public, max-age=' + FRESH_SECONDS)),
          cache.put(backupKey, json(body, 200, 'public, max-age=' + BACKUP_SECONDS)),
        ]).catch(() => {})
      );
    }
    return json(body, 200, 'public, max-age=' + BROWSER_SECONDS);
  } catch (err) {
    // 3. YouTube failed: fall back to the last good list, if there is one.
    const backup = cache ? await cache.match(backupKey).catch(() => null) : null;
    if (backup) return json(await backup.text(), 200, 'public, max-age=60');

    const message = (err && err.message) || String(err);
    return json(JSON.stringify({ videos: [], error: message }), 502, 'no-store');
  }
}

// Tries each feed in turn and returns up to MAX_VIDEOS videos, newest first.
async function loadVideos() {
  let lastError = new Error('No videos found in the YouTube feed');
  for (const url of FEEDS) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; yesboone.com video list)' },
      });
      if (!res.ok) throw new Error('YouTube feed returned HTTP ' + res.status);
      const videos = parseFeed(await res.text())
        .filter((v) => !v.short && !HIDE_IDS.includes(v.id))
        .slice(0, MAX_VIDEOS)
        .map(({ id, title, published }) => ({ id, title, published }));
      if (videos.length) return videos;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

// Turns YouTube's feed (XML) into [{ id, title, published, short }], newest first.
function parseFeed(xml) {
  const videos = [];
  const entries = xml.match(/<entry\b[^>]*>[\s\S]*?<\/entry>/g) || [];
  for (const entry of entries) {
    const id = pick(entry, /<yt:videoId>([\w-]{11})<\/yt:videoId>/);
    if (!id) continue;
    const title = decode(pick(entry, /<title>([\s\S]*?)<\/title>/));
    const published = pick(entry, /<published>([^<]+)<\/published>/);
    const link = pick(entry, /<link\b[^>]*\bhref="([^"]+)"/);
    const short = link.includes('/shorts/') || /#shorts?\b/i.test(title);
    videos.push({ id, title, published, short });
  }
  return videos.sort((a, b) => Date.parse(b.published || 0) - Date.parse(a.published || 0));
}

function pick(text, pattern) {
  const match = text.match(pattern);
  return match ? match[1].trim() : '';
}

function decode(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function json(body, status, cacheControl) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
    },
  });
}
