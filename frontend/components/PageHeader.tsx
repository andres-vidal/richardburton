import { FC } from "react";

/**
 * The heading for a page: a left-aligned title with an optional muted description,
 * aligned with the breadcrumb above it. Lives in a page's `Layout` subheader and
 * names the page — replacing the old centered "strike" heading.
 *
 * A plain element rather than a `header`: the layout already has one, and a
 * `header` inside it reads as a second banner landmark nested in the first.
 */
const PageHeader: FC<{ title: string; description?: string }> = ({
  title,
  description,
}) => (
  <div className="px-1 my-4 md:px-0">
    <h1 className="text-2xl font-normal text-gray-900">{title}</h1>
    {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
  </div>
);

export default PageHeader;
