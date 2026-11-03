# ISS Flyover design system: "bright mission control"

A deep-space frame with bright accents around a clean, colorful map (decision D6).
Source of truth: the `@theme` block in `src/app/globals.css`. `tests/design-tokens.test.ts`
reads those values and fails if a pairing below drops under WCAG AA.

## Rules

1. **Solid surfaces.** Text never sits on the starfield or the map; panels and map overlays use `surface` at 95% or more.
2. **Hover changes the fill, not the shade.** Dark → bright (`secondary` → cyan), bright → white (`primary`), nothing → `hover` (`ghost`). The test requires at least 1.3:1 between rest and hover fills. Shade-only hovers (the old "Follow the ISS" button) were invisible.
3. **One focus ring everywhere:** 3 px gold outline, 2 px offset (`focusRing`).
4. **Text sizes:** 16 px body, 14 px minimum for anything a user needs to read (labels, telemetry, city details). 12 px only for the footer credits.
5. **Each accent has one job.** Gold = the ISS and primary actions. Cyan = the footprint, links, and section labels. Magenta = your cities. Violet = the trail (map only). Fresh/stale/down = **data state only**.
6. **Disabled = flat.** `raised` fill with muted text, no shadow, no hover.

## Tokens

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `bg` | `#0a1036` | page background, header, footer | — |
| `surface` | `#18226b` | panels, map overlays | text 14.2:1 · muted 9.8:1 |
| `raised` | `#24308a` | list rows, inputs, secondary buttons | text 11.3:1 · muted 7.8:1 |
| `hover` | `#4050c0` | ghost-button hover fill | text 6.7:1; 2.1:1 vs surface |
| `line` | `#6b7af0` | borders that must be seen | 3.8:1 on surface |
| `text` | `#ffffff` | primary text | — |
| `muted` | `#cdd4ff` | secondary text | 9.8:1 on surface |
| `ink` | `#0a1036` | text on bright fills | 13.3:1 on gold |
| `gold` | `#ffd84d` | ISS marker, primary button, focus ring | 10.3:1 on surface |
| `cyan` | `#5ce6ff` | footprint, labels, links, secondary hover | 9.6:1 on surface |
| `magenta` | `#ff85dd` | followed-city pins | 6.5:1 on surface |
| `violet` | `#8b5cf6` | trail line (map only) | — |
| `fresh` / `stale` / `down` | `#52f5ad` / `#ffcc4d` / `#ff8585` | freshness pill, "overhead now", errors | ≥ 6.0:1 on surface |

## Components (`src/components/ui/index.tsx`)

- **`Button`** / `buttonClass(variant, size)`: `primary` (gold → white), `secondary` (raised + line border → cyan), `ghost` (→ `hover`), `danger` (muted → red fill, for unfollow). Sizes `sm` 36 px, `md` 44 px (touch target), `icon` 36 px square.
- **`Panel`**: a solid `surface` card with a `line` border; freshness and cities panels tint their border stale/down when needed.
- **`Eyebrow`**: a 14 px mono uppercase cyan section label.
- **`StatusPill`**: a filled fresh/stale/down/neutral pill with `ink` text, so the state reads by both color and word.

## Live-data states

| State | Pill | Panel border | Map |
|---|---|---|---|
| Loading | neutral "Connecting" | default | skeleton + "Locating the ISS…" |
| Fresh | green "Live" (pulsing) | default | full color; marker glides |
| Stale | amber "Stale" | amber | faded, marker frozen at the last fix |
| Down | red "Source down" + error text | red | faded, marker frozen at the last fix |
