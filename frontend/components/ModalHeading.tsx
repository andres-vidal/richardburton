import { FC, ReactNode } from "react";

/**
 * Renders what a dialog is called as an `h1` in a bar pinned to the top of the
 * dialog while its content scrolls, so the heading stays in view in a long
 * dialog. `subheading` is a line under the heading, and `aside` sits at the end
 * of the bar.
 *
 * The bar spans the padding around it with negative margins, so it must be the
 * first child of an element with `p-8`. Its background is translucent and
 * blurred, so the content that scrolls under it stays faintly visible.
 */
const ModalHeading: FC<{
  heading: ReactNode;
  /** A line under the heading, pinned with it. */
  subheading?: ReactNode;
  /** Set against the heading at the end of the bar, such as a position in a queue. */
  aside?: ReactNode;
  /** The `id` of the `h1`, for a dialog named by its heading. */
  id?: string;
}> = ({ heading, subheading, aside, id }) => (
  <div className="flex sticky top-0 z-40 gap-4 justify-between items-baseline -mx-8 -mt-8 px-8 pt-8 pb-3 border-b border-gray-200 backdrop-blur-xl bg-white/70">
    <div className="space-y-1 min-w-0">
      <h1 id={id} className="text-xl font-normal truncate">
        {heading}
      </h1>
      {subheading && <p className="text-sm text-gray-600">{subheading}</p>}
    </div>
    {aside && (
      <span className="text-sm text-gray-600 shrink-0 tabular-nums">
        {aside}
      </span>
    )}
  </div>
);

export default ModalHeading;
