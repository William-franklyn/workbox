import { MARK_PATH, MARK_VIEWBOX, MARK_ASPECT } from "@/lib/brand-mark";

/**
 * The WorkBox node-network mark as an inline SVG. `color` defaults to
 * `currentColor` so it inherits the surrounding text color; pass an explicit
 * color (e.g. "#0b0b12" / "#ffffff") on tinted tiles. `size` is the height in px.
 */
export default function BrandMark({
  size = 20,
  color = "currentColor",
  className,
  style,
}: {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={Math.round(size * MARK_ASPECT)}
      height={size}
      viewBox={MARK_VIEWBOX}
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path fill={color} d={MARK_PATH} />
    </svg>
  );
}
