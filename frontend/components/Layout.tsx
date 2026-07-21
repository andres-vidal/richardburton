"use client";

import Dot from "assets/dot.svg";
import Logo from "assets/logo.svg";
import Link from "next/link";
import { FC, ReactNode, useEffect, useRef } from "react";
import Anchor from "./Anchor";
import { CONTACT_MODAL_KEY } from "./ContactModal";
import { LEARN_MORE_MODAL_KEY } from "./LearnMoreModal";

type Props = {
  title?: string;
  footer?: ReactNode;
  content: ReactNode;
  subheader?: ReactNode;
  leftAside?: ReactNode;
};

const HEADING_TEXT = "Richard & Isabel Burton Platform";
const SUBHEADING_TEXT = "A database about Brazilian literature in translation";

// `title` is set per-route via the App Router `metadata` export, not here — the
// prop is kept so existing callers still typecheck during the migration.
const Layout: FC<Props> = ({ footer, content, subheader, leftAside }) => {
  const headerRef = useRef<HTMLElement>(null);

  // Publish the header's height as `--app-header-h` so the table's column headers
  // can pin at its bottom (the end of the searchbar panel), not behind it. A
  // ResizeObserver keeps it current as the searchbar panel grows/shrinks or the
  // banner wraps at the mobile breakpoint.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const publishHeight = () =>
      document.documentElement.style.setProperty(
        "--app-header-h",
        `${header.offsetHeight - 1}px`,
      );

    publishHeight();
    const observer = new ResizeObserver(publishHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col min-h-screen px-1 md:px-8">
      <header ref={headerRef} className="sticky top-0 z-30 bg-gray-100">
        <h1 className="select-none py-1.5 -mx-8 text-center text-white bg-indigo-600 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center shrink transition-colors md:flex-row md:gap-4 shadow-white">
            <Link href="/" className="px-3 py-0.5 rounded hover:bg-indigo-500">
              <span className="inline-flex items-center gap-3 py-1 pr-5 text-lg font-medium md:pr-0">
                <Logo className="h-8" />
                {HEADING_TEXT}
              </span>
            </Link>
            <hr className="w-0.5 mr-2 h-8 bg-current border-none hidden md:block" />
            <div className="inline text-base">{SUBHEADING_TEXT}</div>
            <hr className="w-0.5 h-8 mx-2 bg-current border-none hidden md:block" />
            <div className="flex items-center gap-2 mt-2 md:contents md:mt-0">
              <Anchor query={`${LEARN_MORE_MODAL_KEY}=true`}>Learn More</Anchor>
              <Dot className="size-1" />
              <Anchor query={`${CONTACT_MODAL_KEY}=true`}>Contact Us</Anchor>
            </div>
          </div>
        </h1>
        {subheader}
      </header>
      <div className="flex flex-col grow gap-2 md:flex-row">
        {leftAside && <aside>{leftAside}</aside>}
        <main className="relative grow pb-4">{content}</main>
      </div>
      {footer && (
        <footer className="sticky bottom-0 z-30 py-1 bg-gray-100 md:py-4">
          {footer}
        </footer>
      )}
    </div>
  );
};

export default Layout;
export { SUBHEADING_TEXT };
