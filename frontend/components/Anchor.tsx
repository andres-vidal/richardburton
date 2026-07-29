import Link from "next/link";
import { FC, PropsWithChildren } from "react";

interface Props extends PropsWithChildren {
  query?: string;
  href?: string;
  /** Makes it a button, so an action sitting among links reads as one of them. */
  onClick?: () => void;
}

const Anchor: FC<Props> = ({ query, href = "", onClick, children }) => {
  const Tag = href.startsWith("http") ? "a" : Link;

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
