import { useTranslations } from "next-intl";
import { CSSProperties, FC, ReactNode } from "react";

/**
 * A status named "Loading" around placeholder shapes, which it hides from
 * assistive technology.
 *
 * The status stays transparent for its first 150ms and then fades in, so a
 * load that finishes sooner never shows it. A mask fades its lower half out
 * towards the bottom edge.
 */
const Skeleton: FC<{ children: ReactNode }> = ({ children }) => {
  const t = useTranslations("common");

  return (
    <div
      role="status"
      aria-label={t("loading")}
      className="animate-skeleton-appear mask-b-from-50%"
    >
      <div aria-hidden="true">{children}</div>
    </div>
  );
};

type SkeletonShape = "line" | "pill" | "button";
type SkeletonLength = "short" | "medium" | "long" | "full";

interface BarProps {
  /**
   * What the shape stands for: `line` for a line of text, `pill` for a tag
   * that holds one name, and `button` for a small button. Defaults to `line`.
   */
  shape?: SkeletonShape;
  /**
   * How long the shape is. A line takes a share of the width it is in:
   * `short` a third, `medium` a half, `long` three quarters and `full` all of
   * it. A pill or a button has a fixed length: `short` 3rem, `medium` 5rem and
   * `long` 7rem, and `full` takes all of the width. Defaults to `full`.
   */
  length?: SkeletonLength;
  /** Whether the shape is paler, for text that is secondary. */
  muted?: boolean;
}

/**
 * A grey placeholder shape. While motion is allowed, its opacity pulses, and
 * the pulse starts 90ms later for each step of the `--row` custom property.
 * A placeholder row sets `--row` to its index with `skeletonRow`, so the pulse
 * moves down the rows. With reduced motion the shape is still.
 *
 * In a flex container that is too narrow for its shapes, a shape shrinks below
 * its length.
 */
const SkeletonBar: FC<BarProps> = ({
  shape = "line",
  length = "full",
  muted = false,
}) => (
  <span
    data-shape={shape}
    data-length={length}
    data-muted={muted}
    className="
      block min-w-0 motion-safe:animate-skeleton-wave
      data-[muted=false]:bg-gray-300 data-[muted=true]:bg-gray-200
      data-[shape=line]:h-3.5 data-[shape=line]:rounded
      data-[shape=pill]:h-5 data-[shape=pill]:rounded-full
      data-[shape=button]:h-7 data-[shape=button]:rounded
      data-[length=full]:w-full
      data-[shape=line]:data-[length=short]:w-1/3 data-[shape=line]:data-[length=medium]:w-1/2 data-[shape=line]:data-[length=long]:w-3/4
      not-data-[shape=line]:data-[length=short]:w-12 not-data-[shape=line]:data-[length=medium]:w-20 not-data-[shape=line]:data-[length=long]:w-28
    "
  />
);

/** The style of a placeholder row, which holds the row's index in `--row`. */
type SkeletonRowStyle = CSSProperties & { "--row": number };

/**
 * Returns the style of the placeholder row at `index`, which sets the `--row`
 * custom property to `index`. `SkeletonBar` delays its pulse by 90ms for each
 * step of `--row`.
 */
const skeletonRow = (index: number): SkeletonRowStyle => ({ "--row": index });

export { Skeleton, SkeletonBar, skeletonRow };
export type { SkeletonLength, SkeletonShape };
