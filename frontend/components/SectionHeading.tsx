import { FC } from "react";

/** The class list itself, for headings that are not an `h2` — a `summary` that
 * opens a section, say. */
const SECTION_HEADING =
  "text-sm font-medium tracking-wide text-gray-600 uppercase";

/**
 * What a section of a page or a dialog is called: quiet, small and set apart
 * from the content under it, so a page of sections reads as one thing rather
 * than several competing for the eye.
 */
const SectionHeading: FC<{ children: string }> = ({ children }) => (
  <h2 className={SECTION_HEADING}>{children}</h2>
);

export default SectionHeading;
export { SECTION_HEADING };
