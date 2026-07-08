import Logo from "assets/logo.svg";
import clsx from "classnames";
import { FC, ReactNode } from "react";

interface Props {
  heading: ReactNode;
  content: ReactNode;
  aside?: ReactNode;
  noSeparator?: boolean;
}

const Article: FC<Props> = ({ content, heading, aside, noSeparator }) => {
  return (
    <article className="relative flex flex-col w-full min-h-full gap-5 p-8 sm:flex-row overflow-clip">
      <Logo className="absolute z-50 lg:w-screen h-screen lg:h-auto text-indigo-700 pointer-events-none opacity-20 left-[-70%] sm:left-[-52%] -top-44 sm:-top-96 aspect-square" />
      {!noSeparator && (
        <hr className="absolute inset-x-7 top-28 sm:top-22 z-40" />
      )}
      <section
        className={clsx("space-y-6 h-fit", aside ? "sm:w-7/12" : "w-full")}
      >
        <header className="sticky z-30 w-full py-2 text-2xl bg-white top-10 sm:top-4">
          <h1 className="flex items-center w-full gap-2 text-2xl font-normal">
            {heading}
          </h1>
        </header>
        {content}
      </section>
      {aside && <aside className="sm:w-5/12">{aside}</aside>}
    </article>
  );
};

export { Article };
