import { FC } from "react";

/**
 * Renders a page's `title` as its `h1`, left-aligned, with an optional muted
 * `description` under it.
 *
 * It renders a `div`, not a `header`, because it goes inside the `header` that
 * `Layout` renders, where a nested `header` would read as a second banner
 * landmark.
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
