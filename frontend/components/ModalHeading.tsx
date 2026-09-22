import { FC, ReactNode } from "react";

/**
 * What a dialog is called, pinned to the top of it while its content scrolls.
 *
 * A dialog that scrolls takes its heading out of view with everything else, and
 * a list of thirty things is exactly where the reader most needs to be told
 * what they are reading and how much of it there is.
 *
 * It spans the dialog's padding with negative margins, so it must sit directly
 * inside a `p-8` body. Translucent rather than opaque, so the content reads as
 * passing underneath rather than stopping at an edge.
 */
const ModalHeading: FC<{
  heading: ReactNode;
  /** A line under the heading, pinned with it rather than scrolling away. */
  subheading?: ReactNode;
  /** Set against the heading, at the end of the bar — a position in a queue. */
  aside?: ReactNode;
}> = ({ heading, subheading, aside }) => (
  <div className="flex sticky top-0 z-40 gap-4 justify-between items-baseline -mx-8 -mt-8 px-8 pt-8 pb-3 border-b border-gray-200 backdrop-blur-xl bg-white/70">
    <div className="space-y-1 min-w-0">
      <h1 className="text-xl font-normal truncate">{heading}</h1>
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
