# GlowDaily Nutrition — project notes for Claude

Static site (no build step) deployed to **Netlify** from GitHub `t3kdesigns03/glowdaily`
`main`. Live: https://glowdailynutrition.com. Read this before exploring — it captures
what costs the most to re-derive.

## Architecture
- **Pure static HTML**, everything inline (CSS in `<style>`, JS in `<script>`). No shared
  JS/CSS file, no npm, no bundler. External deps via CDN only (jsDelivr Supabase/EmailJS;
  dashboard also React 18 + Babel standalone).
- Netlify serves by literal path (no `netlify.toml` / `_redirects`), so a new `foo/index.html`
  is reachable at `/foo/`.

## Files
- `index.html` — public storefront + order form (plain HTML/JS). Cosmic theme (`:root`
  vars ~L15-45: `--space --navy --teal --purple --gold --orange`; no `--volt`, use `#D6F224`).
- `dashboard.html` — **React 18 + Babel-in-browser SPA**, **light Tailwind theme** (NOT cosmic).
  Pages swap via `page` state + `PAGE` map; nav via `NAV`/`TITLES`. Password-gated (sha256).
  Shared components: `Lbl Input Sel Btn Modal Empty`. Helpers `loadFromCloud`/`saveToCloud`.
- `popups/index.html`, `e/index.html` — public event pages (cosmic; self-contained).
- `blaze/index.html` — **separate app (Blaze Remix fundraiser). DO NOT TOUCH** it, Blaze
  credit math, roster, or its Venmo. In dashboard, Blaze code + wiring is off-limits too.

## Data — Supabase `gd_store` (single key/value table)
Row shape `{ key, value(jsonb), updated_at }`, upsert `onConflict:'key'`. URL + anon key are
inline in each file (public by design). Keys: `products`, `orders`, `monthly_special`,
`ingredients`, `transactions`, **`events`**.
- Read: `sb.from('gd_store').select('value').eq('key',K).maybeSingle()`
- Write: `sb.from('gd_store').upsert({key,value,updated_at},{onConflict:'key'})`

## Events / pre-order system (pop-ups, tea drops, schools)
Events are a **fulfillment context on the one menu**, not a second store. Three doors:
homepage `#order` (Event/Pop-Up → pick a stop or Other/Tea Drop), `/popups/` hub,
`/e/?event={slug}` locked door. Managed in the dashboard **Events** tab.
- `events` = array of `{id, slug, name, type:'popup'|'teadrop'|'school', date, startTime,
  endTime, location, notes, active, cutoffISO, flavorIds, fundraiser}`.
- "Orderable" rule (shared by every surface): `active===true` && date not past (end of day)
  && (`cutoffISO`==null || now < cutoffISO). Homepage helper `isEventOrderable`; dashboard
  `orderFulfillment`/`fulfillLabel`/`slugify`/`uniqueSlug`.
- Orders carry real fields: `fulfillment` ('pickup'|'event'|'ship'), `eventId, eventSlug,
  eventName, eventLocation, eventType, eventCustomLocation`; plus `Event: …` appended to `note`.
  pickup/event use pickup price; `status` stays `Received`.

## Deploy
Push/merge to `main` → Netlify auto-publishes (usually 1-3 min). If the live site doesn't
update, check Netlify → Deploys (auto-publish off / build failed / queued). No CLI access to
Netlify here. Fallback for reverts: tag `pre-popups-2026-09-10` marks pre-events state.

## Gotchas
- EmailJS fires on public order submit (`emailjs.send`) — stub it when dry-run testing so
  you don't email Jennifer.
- To test locally: `python -m http.server 8777` then open over http (Supabase reads dislike
  `file://`). Nothing shows on the public event pages until an event exists in `gd_store`.
