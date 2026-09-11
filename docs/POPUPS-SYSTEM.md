# GlowDaily — Pop-Ups / Tea Drops / School Pre-Order System

**Status:** ✅ Live on https://glowdailynutrition.com (merged to `main`, PR #1)
**Shipped:** 2026-09-10
**Pre-change fallback tag:** `pre-popups-2026-09-10`

---

## 1. What it is (in one breath)

Events are a **fulfillment context on the existing menu** — *not* a second store.
One menu, one cart, one Supabase catalog, with **three doors** into it:

| Door | URL | Who uses it |
|---|---|---|
| Homepage order form | `/#order` → pick **Event / Pop-Up** | Anyone on the main site |
| Public hub | `/popups/` | Browsers looking for "where can I catch you?" |
| Shareable event link | `/e/?event={slug}` | A school/PTA/tea-drop crowd, fulfillment locked |

The point of v1: **get the location onto the order**, let Jennifer **pack by event** in the
dashboard, and give her a **shareable school link**.

---

## 2. Data model — Supabase `gd_store` key `events`

`gd_store` is one key/value table (`{ key, value(jsonb), updated_at }`). The events layer
adds one key, `events`, holding an array of:

```js
{
  id: "evt_ab12cd",          // stable id
  slug: "lincoln-elem-fall", // used in /e/?event=SLUG, auto-generated, unique, editable
  name: "Lincoln Elementary Fall Kickoff",
  type: "popup" | "teadrop" | "school",
  date: "2026-09-20",        // YYYY-MM-DD
  startTime: "16:00",        // 24h
  endTime: "18:00",
  location: "Gym entrance",
  notes: "Order by Friday",  // optional
  active: true,              // master on/off switch
  cutoffISO: null,           // optional hard deadline (ISO string); null = none
  flavorIds: [],             // reserved, unused in v1
  fundraiser: false          // reserved, unused in v1 (no fundraiser math built)
}
```

### The "orderable" rule (shared by every surface)
An event shows up for ordering only when **all** are true:
- `active === true`
- event date is **not past** (valid through the end of that local day)
- `cutoffISO` is null **or** now is before it

Homepage helper: `isEventOrderable(ev)`. Dashboard mirrors it in filtering.
Inactive / past-date / past-cutoff events silently disappear from the hub and the
homepage dropdown.

---

## 3. What an order stores

All existing order keys are unchanged. These **real top-level fields** were added:

```js
fulfillment: "pickup" | "event" | "ship",
eventId, eventSlug, eventName, eventLocation, eventType,   // set for chosen events
eventCustomLocation                                        // set for "Other / Tea Drop"
```

Plus, for readability in the existing dashboard, `" | Event: {name or custom location}"`
is appended to the order's `note`.

Rules:
- pickup / event → pickup pricing, **no shipping address required**
- `status` stays `"Received"`
- payment stays Venmo `@GlowDaily` / Square / Cash

Orders write to `gd_store.orders` (prepended), the **same array the dashboard reads** —
verified against the live site.

---

## 4. The three doors in detail

### 4a. Homepage `/#order`
- Fulfillment dropdown: In-Person Pickup / **Event / Pop-Up** / Ship to Me.
- Choosing **Event / Pop-Up** reveals: a dropdown of live events + **Other / Tea Drop**.
  - Pick a listed event → its id/slug/name/location/type are stored.
  - Pick **Other / Tea Drop** → a required free-text box (min 3 chars) → stored as
    `eventCustomLocation` with `eventType: "teadrop"`.
- Validates before submit; blocks with the inline error if no stop / no location.
- Thank-you line for event orders:
  *"We'll pack this for {name or custom location}. Pickup at {location} on {date}."*

### 4b. Public hub `/popups/`
- Cosmic theme, same header/nav as the homepage.
- One card per **orderable** event: name, type badge (Pop-Up / Tea Drop / School), date,
  time window, location, and **"Order for this event →"** → `/e/?event={slug}`.
- Empty state: *"No pop-ups on the calendar right now…"*

### 4c. Event door `/e/?event={slug}`
- Static, query-string based (Netlify serves `/e/index.html`; **no server route**).
- Reads `?event=`, loads `events` + `products` from `gd_store`.
- Missing / inactive / past → **"This event is closed"** with links to `/` and `/popups/`;
  submission blocked.
- Live → banner: *"Ordering for {name} · {date} · {start}–{end} · {location}"*.
- Fulfillment **locked** to the event: ship address + the dropdown are hidden, replaced by a
  read-only chip. Always pickup pricing. Every order written carries this event's id/slug/
  name/location/type with `fulfillment: "event"`.
- Full homepage experience: same menu, cart, 12-pack picker, Flavor Friday — products still
  sourced from `gd_store` (no second catalog).

---

## 5. Dashboard (`dashboard.html`)

React 18 + Babel-in-browser SPA, light Tailwind theme (password-gated).

### New **Events** tab
- Lists events with type badge, date/time/location, order count, and the public slug.
- **Active** toggle, **Copy link** (`https://glowdailynutrition.com/e/?event={slug}`),
  **Edit**, **Delete**.
- **Add / Edit** modal: name, type, date, start/end time, location, notes, active,
  and an **auto-generated slug** (from the name) that's editable and kept **unique**.
- Persists to `gd_store.events` via the same `saveToCloud` used everywhere else; also
  included in Backup/Restore export.

### **Orders** tab upgrades
- New filter chips: **All / Pickup / Event / Ship** (reads `fulfillment`; falls back to
  parsing legacy rows).
- A dropdown of **events that have ≥1 order** — pick a school to see just that batch.
- Each order row shows its fulfillment/event label (📍 event name, 🚚 ship, 🏠 pickup).
- Blaze tab, credit math, roster, ingredients/margins/books: **untouched.**

---

## 6. Files changed / added

| File | Change |
|---|---|
| `index.html` | Event fulfillment block + JS, nav "Pop-Ups", contact card, thank-you |
| `dashboard.html` | Events tab + components, Orders filters, persistence wiring |
| `popups/index.html` | **New** — public hub |
| `e/index.html` | **New** — locked event door |
| `CLAUDE.md` | **New** — dev reference (architecture, patterns, gotchas) |

---

## 7. Deploy & rollback

- Static site on **Netlify**, deploys from GitHub `main`.
- Auto-publish was found **off** during this ship — a manual **Deploys → Trigger deploy**
  (or drag-and-drop of the project root) publishes. Re-enable auto-publish for hands-free
  future deploys.
- **Rollback:** the tag `pre-popups-2026-09-10` marks the pre-events commit. A deploy
  never touches the Supabase DB — orders/events are safe across deploys and rollbacks.

---

## 8. How it was verified (no test data left behind)

Tested end-to-end against a **temporary seeded event**, then deleted it — **zero test orders
written, no emails sent** (network + EmailJS stubbed during dry-runs):

- Homepage dropdown lists active events; payload = `fulfillment:"event"` + all event fields ✅
- Other/Tea Drop stores `eventCustomLocation`, blocks <3-char input ✅
- Event door: banner, locked chip, correct payload, correct thank-you ✅
- Inactive / past-date / past-cutoff events excluded everywhere ✅
- Regressions clean: Flavor Friday, 12-pack picker, monthly special, nav, Blaze ✅
- Live source confirmed: same Supabase project, writes to `gd_store.orders`, event fields present ✅

---

## 9. Deliberately NOT in v1 (guardrails honored)

- No per-event flavor menu (`flavorIds` exists but unused).
- No fundraiser math (`fundraiser` exists but unused).
- No forced shipping, no server-side path router, no second catalog/store.
- Location is a **real order field**, never swallowed only inside `note`.
