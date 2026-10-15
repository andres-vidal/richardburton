"use client";

import Dot from "assets/dot.svg";
import Logo from "assets/logo.svg";
import { signOut, useIsAuthenticated } from "modules/session";
import { Link } from "i18n/navigation";
import { useTranslations } from "next-intl";
import { FC, ReactNode, useEffect, useRef } from "react";
import Anchor from "./Anchor";
import LanguageSwitcher from "./LanguageSwitcher";
import { ContactModal, CONTACT_MODAL_KEY } from "./ContactModal";
import { LearnMoreModal, LEARN_MORE_MODAL_KEY } from "./LearnMoreModal";

type Props = {
  footer?: ReactNode;
  content: ReactNode;
  subheader?: ReactNode;
  /**
   * How the page is laid out across the viewport. `full` fills it, for wide
   * tables. `aligned` holds the subheader and the content to one column of
   * readable width, both starting at the page's gutter, where the banner's
   * content begins.
   */
  measure?: "full" | "aligned";
};

/**
 * Renders the app shell: a sticky header with the banner and the `subheader`,
 * the `content` in the page's `<main>`, and an optional sticky `footer`. The
 * banner links to the Learn more and Contact modals, which the shell renders,
 * and offers Sign out while someone is signed in.
 *
 * The shell sets the `--app-header-h` CSS variable on the document to the
 * header's height, and keeps it current with a `ResizeObserver`, so a sticky
 * element in the content can pin just under the header.
 */
const Layout: FC<Props> = ({
  footer,
  content,
  subheader,
  measure = "full",
}) => {
  const t = useTranslations("layout");
  const headerRef = useRef<HTMLElement>(null);
  const isAuthenticated = useIsAuthenticated();

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
    <div className="flex flex-col min-h-screen">
      <header ref={headerRef} className="sticky top-0 z-30 bg-gray-100">
        <div className="relative flex justify-center items-center py-1.5 text-white bg-indigo-600 select-none">
          <h1 className="flex flex-col items-center justify-center px-10 shrink text-center transition-colors md:px-12 md:flex-row md:gap-4 shadow-white">
            <Link href="/" className="px-3 py-0.5 rounded hover:bg-indigo-500">
              <span className="inline-flex items-center gap-3 py-1 pr-5 text-lg font-medium md:pr-0">
                <Logo className="h-8" />
                {t("appName")}
              </span>
            </Link>
            <hr className="w-0.5 mr-2 h-8 bg-current border-none hidden xl:block" />
            <div className="hidden text-base xl:inline">{t("tagline")}</div>
            <hr className="w-0.5 h-8 mx-2 bg-current border-none hidden xl:block" />
            <div className="flex items-center gap-2 mt-2 md:contents md:mt-0">
              <Anchor query={`${LEARN_MORE_MODAL_KEY}=true`}>
                {t("learnMore")}
              </Anchor>
              <Dot className="size-1" />
              <Anchor query={`${CONTACT_MODAL_KEY}=true`}>
                {t("contactUs")}
              </Anchor>
              {isAuthenticated && (
                <>
                  <Dot className="size-1" />
                  <Anchor onClick={signOut}>{t("signOut")}</Anchor>
                </>
              )}
            </div>
          </h1>
          <div className="absolute right-2 text-sm md:right-4">
            <LanguageSwitcher />
          </div>
        </div>
        <div
          data-measure={measure}
          className="px-1 md:px-8 data-[measure=aligned]:w-full data-[measure=aligned]:max-w-5xl"
        >
          {subheader}
        </div>
      </header>
      <div className="flex flex-col grow gap-2 md:flex-row">
        <main
          data-measure={measure}
          className="relative grow pb-4 px-1 md:px-8 data-[measure=aligned]:w-full data-[measure=aligned]:max-w-5xl"
        >
          {content}
        </main>
      </div>
      {footer && (
        <footer className="sticky bottom-0 z-30 py-1 px-1 bg-gray-100 md:px-8 md:py-4">
          {footer}
        </footer>
      )}

      <ContactModal />
      <LearnMoreModal />
    </div>
  );
};

export default Layout;
