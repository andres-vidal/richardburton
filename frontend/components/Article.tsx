import Logo from "assets/logo.svg";
import { FC, ReactNode } from "react";

interface Props {
  heading: ReactNode;
  content: ReactNode;
  aside?: ReactNode;
  noSeparator?: boolean;
}

const Article: FC<Props> = ({ content, heading, aside, noSeparator }) => {
  return (
    <article className="flex relative flex-col gap-5 p-8 w-full min-h-full overflow-clip sm:flex-row">
      <Logo className="absolute z-50 lg:w-screen h-screen lg:h-auto text-indigo-700 pointer-events-none opacity-20 left-[-70%] sm:left-[-52%] -top-44 sm:-top-96 aspect-square" />
      {!noSeparator && (
        <hr className="absolute inset-x-7 top-28 z-40 sm:top-22" />
      )}
      <section
        data-aside={Boolean(aside)}
        className={`
          space-y-6 h-fit
          data-[aside=true]:sm:w-7/12
          data-[aside=false]:w-full
        `}
      >
        <header className="sticky top-10 z-30 py-2 w-full text-2xl bg-white sm:top-4">
          <h1 className="flex gap-2 items-center w-full text-2xl font-normal">
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
