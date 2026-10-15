import { FC } from "react";

/**
 * The classes of a section heading, for a heading that cannot be an `h2`, such
 * as the `summary` of a collapsible section.
 */
const SECTION_HEADING =
  "text-sm font-medium tracking-wide text-gray-600 uppercase";

/**
 * Renders the name of a section of a page or a dialog as an `h2` in small,
 * grey capitals, so it stays quieter than the content under it.
 */
const SectionHeading: FC<{ children: string }> = ({ children }) => (
  <h2 className={SECTION_HEADING}>{children}</h2>
);

export default SectionHeading;
export { SECTION_HEADING };
