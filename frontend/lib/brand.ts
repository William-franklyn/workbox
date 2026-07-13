// Node-runtime brand helpers. The raw mark constants live in ./brand-mark so
// they can also be imported by client components without pulling in Buffer.
import { MARK_VIEWBOX, MARK_PATH } from "./brand-mark";

export { MARK_VIEWBOX, MARK_ASPECT, MARK_PATH } from "./brand-mark";

/** Data URI of the mark as an SVG, tinted `fill`. Node runtime only (Buffer). */
export function markDataUri(fill = "#ffffff") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}"><path fill="${fill}" d="${MARK_PATH}"/></svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}
