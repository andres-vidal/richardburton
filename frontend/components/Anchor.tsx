import { Link } from "i18n/navigation";
import NextLink from "next/link";
import { FC, PropsWithChildren } from "react";

interface Props extends PropsWithChildren {
  query?: string;
  href?: string;
  /** Makes it a button, so an action sitting among links reads as one of them. */
  onClick?: () => void;
}

const Anchor: FC<Props> = ({ query, href = "", onClick, children }) => {
  // A link that is only a query stays on the page it is already on, so it keeps
  // that page's locale without being told: there is no path to prefix, and the
  // locale-aware Link has nothing to work with.
  const Tag = href.startsWith("http") ? "a" : href ? Link : NextLink;

  const content = (
    <>
      {children}
      <div
        role="presentation"
        className="w-0 h-px mx-auto -mt-px transition-all bg-current group-hover:w-full"
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
