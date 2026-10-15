import { Link } from "i18n/navigation";
import NextLink from "next/link";
import { FC, PropsWithChildren } from "react";

interface Props extends PropsWithChildren {
  /** A query string appended to `href`, without the leading `?`. */
  query?: string;
  href?: string;
  /** Makes it a button, so an action can sit among links and look like one. */
  onClick?: () => void;
}

/**
 * Renders a text link whose underline grows from the centre on hover. It sets
 * no colour of its own, so it takes the colour of the text around it.
 *
 * An `href` starting with `http` renders a plain `<a>`. Any other `href` goes
 * through the localized `Link`, which adds the current locale to the path. A
 * link with only a `query` goes through `next/link`, since it stays on the
 * current page and so keeps its locale. Given `onClick`, it renders a
 * `<button>` with the same look instead.
 */
const Anchor: FC<Props> = ({ query, href = "", onClick, children }) => {
  const Tag = href.startsWith("http") ? "a" : href ? Link : NextLink;

  const content = (
    <>
      {children}
      <span
        aria-hidden
        className="block mx-auto -mt-px w-0 h-px bg-current transition-all group-hover:w-full"
      />
    </>
  );

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="rounded group focus-ring"
    >
      {content}
    </button>
  ) : (
    <Tag href={`${href}${query ? `?${query}` : ""}`} className="group">
      {content}
    </Tag>
  );
};

export default Anchor;
