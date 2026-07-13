# WorkBox brand mark

The WorkBox icon is the node-network glyph (a hexagon of connected nodes).
Use **only the mark** for square icons — never the mark + "workbox" wordmark,
or the word appears twice next to a "WorkBox" label.

## Files here

| File | Fill | Use for |
| --- | --- | --- |
| `workbox-mark.svg` | `currentColor` | Anything — inherits the surrounding text color. Best default. |
| `workbox-mark-black.svg` | `#0b0b12` | Light backgrounds. |
| `workbox-mark-white.svg` | `#ffffff` | Dark / colored backgrounds. |

All three are transparent and share the viewBox `-0.40 0.00 1817.80 2048.00`
(aspect ratio ≈ 0.887 wide : 1 tall). Full wordmark logos live in
[`/public`](../../public): `logo-light.svg`, `logo-dark.svg`, `logo-black.png`.

## Brand colors

- Mark black: `#0b0b12`
- Mark white: `#ffffff`
- Brand purple (theme color): `#7c3aed`

## Reusing it in code

The mark path is also available programmatically in
[`lib/brand.ts`](../../lib/brand.ts):

```ts
import { markDataUri, MARK_ASPECT, MARK_PATH, MARK_VIEWBOX } from "@/lib/brand";

// A recolored data URI (Node runtime — used by the icon generators):
const src = markDataUri("#0b0b12");
```

### Where it's already used

- `app/icon.svg` — browser-tab favicon (adaptive: black on light, white on dark)
- `app/apple-icon.tsx` — iOS home-screen icon (black mark on a white tile)
- `app/pwa-icon/route.tsx` — Android / desktop PWA install icons
- `app/offline/page.tsx` — offline fallback badge

To render an inline `currentColor` mark in a React component, import the SVG or
inline the path from `lib/brand.ts` and set the `fill` via CSS `color`.
