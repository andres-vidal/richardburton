import Dot from "assets/dot.svg";
import Logo from "assets/logo.svg";
import Head from "next/head";
import Link from "next/link";
import { FC, ReactNode } from "react";
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

const Layout: FC<Props> = ({
  title,
  footer,
  content,
  subheader,
  leftAside,
}) => {
  return (
    <>
      {title && (
        <Head>
          <title>{title}</title>
        </Head>
      )}
      <div className="flex flex-col h-full px-1 md:px-8 overflow-x-clip">
        <header className="sticky top-0 z-20 bg-gray-100 md:pb-6">
          <h1 className="select-none py-1.5 -mx-8 text-center text-white bg-indigo-600 flex items-center justify-center">
            <div className="flex flex-col items-center justify-center shrink transition-colors md:flex-row md:gap-4 shadow-white">
              <Link
                href="/"
                className="px-3 py-0.5 rounded hover:bg-indigo-500"
              >
                <span className="inline-flex items-center gap-3 py-1 pr-5 text-lg font-medium md:pr-0">
                  <Logo className="h-8" />
                  {HEADING_TEXT}
                </span>
              </Link>
              <hr className="w-0.5 mr-2 h-8 bg-current border-none hidden md:block" />
              <div className="inline text-base">{SUBHEADING_TEXT}</div>
              <hr className="w-0.5 h-8 mx-2 bg-current border-none hidden md:block" />
              <div className="flex items-center gap-2 mt-2 md:contents md:mt-0">
                <Anchor query={`${LEARN_MORE_MODAL_KEY}=true`}>
                  Learn More
                </Anchor>
                <Dot className="size-1" />
                <Anchor query={`${CONTACT_MODAL_KEY}=true`}>Contact Us</Anchor>
              </div>
            </div>
          </h1>
          {subheader}
        </header>
        <div className="flex flex-col h-full gap-2 md:flex-row overflow-clip">
          {leftAside && <aside>{leftAside}</aside>}
          <main className="relative pb-4 overflow-y-auto overflow-x-clip grow scrollbar-thin scrollbar-thumb-indigo-600">
            {content}
          </main>
        </div>
        <footer className="sticky bottom-0 py-1 bg-gray-100 md:py-4">
          {footer}
        </footer>
      </div>
    </>
  );
};

export default Layout;
export { SUBHEADING_TEXT };
