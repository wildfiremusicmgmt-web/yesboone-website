# Yes Boone — Website

Static single-page site. No build step, no dependencies, no backend.

## Deploy (Cloudflare Pages)

1. Upload the contents of this folder to the repo root of
   `wildfiremusicmgmt-web/Wildfire-Boone` (branch `main`).
2. Cloudflare dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git
3. Select the repo. Settings:
   - Framework preset: **None**
   - Build command: **(leave blank)**
   - Build output directory: **/**
   - Production branch: **main**
4. Deploy. Test the generated `*.pages.dev` URL.
5. Custom domains -> add `yesboone.com` and `www.yesboone.com`.

## Files

| File | Purpose |
|---|---|
| `index.html` | Entire site. All images, font and JS embedded. |
| `favicon.png` | Browser tab icon |
| `og.png` | 1200x630 social share preview |
| `_headers` | Cloudflare security + cache headers |
| `robots.txt` | Search crawler rules |
| `sitemap.xml` | Search index hint |

## Editing after launch

Everything lives in `index.html`. Edit it on GitHub directly
(pencil icon -> commit) and Cloudflare redeploys in ~30 seconds.
Every commit is a rollback point.

Common edits, all findable with Ctrl+F in `index.html`:

- Store URL: search `STORE`
- Cobrand / Direct Access link: search `drop.cobrand.com`
- DSP links: search `open.spotify.com`
- Canonical domain: search `yesboone.com` (also update in `_headers` refs and `sitemap.xml`)

## Rollback

GitHub: repo -> Commits -> pick a good commit -> Revert.
Cloudflare: Pages project -> Deployments -> pick a good build -> Rollback.

## Live feeds

- Tickets: Bandsintown widget, artist id 15605475. Updates automatically.
- Videos: YouTube uploads feed for @yesboone. Updates automatically.

Both have plain-text fallback links if a visitor's browser blocks embeds.

## Before announcing

- [ ] Confirm `yesboone.com` registrar and enable auto-renew
- [ ] Test on a real iPhone and a real Android
- [ ] Paste the URL into a DM to check the `og.png` preview unfurls
- [ ] Confirm store URL points at the real storefront
- [ ] Add Cloudflare Web Analytics (free, cookieless, no consent banner)

## Domain — yesboone.com (registered at NameSilo)

Registrar stays NameSilo. Only DNS moves to Cloudflare.

1. Cloudflare dashboard -> Add a site -> yesboone.com -> Free plan.
2. Cloudflare shows two nameservers, e.g. `xxx.ns.cloudflare.com`.
3. NameSilo -> Domain Manager -> tick yesboone.com -> Change Nameservers.
   Replace the NameSilo defaults with the two Cloudflare ones. Save.
4. Wait for Cloudflare to report the domain as Active (usually <1 hour).
5. Workers & Pages -> your project -> Custom domains -> add `yesboone.com`
   and `www.yesboone.com`. Cloudflare creates the records automatically.
6. NameSilo -> turn ON auto-renew. An expired domain is the most common
   way a small site quietly dies.

The `_redirects` file forces www -> apex so there is one canonical address.

Do NOT transfer the domain to Cloudflare. Changing nameservers is enough
and keeps billing where it is.
