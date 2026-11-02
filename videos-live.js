# Yes Boone - keeps videos.json up to date with the newest YouTube uploads.
# Long-form videos only (no Shorts). Runs every hour on GitHub (free). If YouTube can't be reached, nothing changes
# and the site keeps showing the last good list.
# EDIT ME: HIDE_IDS = video IDs to never show, e.g. ['abcdefghijk']; MAX_VIDEOS = how many cards.
name: Update latest videos

on:
  schedule:
    - cron: '17 * * * *'   # every hour, at 17 minutes past
  workflow_dispatch:        # adds a "Run workflow" button in the Actions tab

permissions:
  contents: write

concurrency:
  group: update-videos
  cancel-in-progress: false

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Read the YouTube feed
        run: |
          node --input-type=module <<'EOF'
          import fs from 'node:fs';
          const CHANNEL_ID = 'UCt0bc5uqdaC0bcihYZZbytw';   // youtube.com/@yesboone
          const MAX_VIDEOS = 5;
          const HIDE_IDS = [];
          // Long-form videos only: YouTube's "videos" list for the channel (UULF...), which excludes Shorts.
          // No all-uploads backup, so a Short can never slip in. If this list can't be read, nothing changes.
          const FEEDS = [
            'https://www.youtube.com/feeds/videos.xml?playlist_id=UULF' + CHANNEL_ID.slice(2),
          ];
          const pick = (t, re) => { const m = t.match(re); return m ? m[1].trim() : ''; };
          const decode = (t) => t.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
            .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&quot;/g, '"').replace(/&apos;/g, "'")
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
          function parse(xml) {
            return (xml.match(/<entry\b[^>]*>[\s\S]*?<\/entry>/g) || []).map((e) => ({
              id: pick(e, /<yt:videoId>([\w-]{11})<\/yt:videoId>/),
              title: decode(pick(e, /<title>([\s\S]*?)<\/title>/)),
              published: pick(e, /<published>([^<]+)<\/published>/),
              link: pick(e, /<link\b[^>]*\bhref="([^"]+)"/),
            })).filter((v) => v.id && !v.link.includes('/shorts/') && !/#shorts?\b/i.test(v.title) && !HIDE_IDS.includes(v.id))
              .sort((a, b) => Date.parse(b.published || 0) - Date.parse(a.published || 0))
              .slice(0, MAX_VIDEOS).map(({ id, title, published }) => ({ id, title, published }));
          }
          let videos = [];
          for (const url of FEEDS) {
            for (let attempt = 1; attempt <= 3 && !videos.length; attempt++) {
              try {
                const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; yesboone.com video list)' } });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                videos = parse(await res.text());
                if (!videos.length) throw new Error('no videos in feed');
              } catch (err) {
                console.log(`Feed ${url} attempt ${attempt} failed: ${err.message}`);
                await new Promise((r) => setTimeout(r, 5000 * attempt));
              }
            }
            if (videos.length) break;
          }
          if (!videos.length) { console.log('YouTube not reachable - keeping the current videos.json'); process.exit(0); }
          let old = null;
          try { old = JSON.parse(fs.readFileSync('videos.json', 'utf8')); } catch {}
          if (old && JSON.stringify(old.videos) === JSON.stringify(videos)) { console.log('No new videos'); process.exit(0); }
          fs.writeFileSync('videos.json', JSON.stringify({ videos, updated: new Date().toISOString() }, null, 1) + '\n');
          console.log('Saved:', videos.map((v) => v.title).join(' | '));
          EOF

      - name: Save to the repo (only if the list changed)
        run: |
          if [ -z "$(git status --porcelain -- videos.json)" ]; then echo "Nothing to save"; exit 0; fi
          git config user.name "github-actions[bot]"
          git config user.email "41898283+github-actions[bot]@users.noreply.github.com"
          git add videos.json
          git commit -m "Update latest videos"
          git push
