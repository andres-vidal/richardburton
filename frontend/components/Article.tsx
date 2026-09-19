import Logo from "assets/logo.svg";
import { FC, ReactNode } from "react";

interface Props {
  heading: ReactNode;
  content: ReactNode;
  aside?: ReactNode;
  asideHeading?: ReactNode;
  noSeparator?: boolean;
}

const Article: FC<Props> = ({
  content,
  heading,
  aside,
  asideHeading,
  noSeparator,
}) => {
  return (
    <article className="flex relative flex-col gap-5 p-8 w-full min-h-full overflow-clip">
      <Logo className="absolute z-0 lg:w-screen h-screen lg:h-auto text-indigo-700 pointer-events-none opacity-20 left-[-70%] sm:left-[-52%] -top-44 sm:-top-96 aspect-square" />

      <div
        data-separator={!noSeparator}
        className="flex sticky top-0 z-40 gap-5 -mx-8 -mt-8 px-8 pt-8 pb-2 border-gray-200 backdrop-blur-xl bg-white/70 data-[separator=true]:border-b"
      >
        <h1
          data-aside={Boolean(aside)}
          className="flex gap-2 items-center w-full text-2xl font-normal data-[aside=true]:sm:w-7/12"
        >
          {heading}
        </h1>
        {asideHeading && (
          <div className="hidden text-lg sm:block sm:w-5/12">
            {asideHeading}
          </div>
        )}
      </div>

      <div className="flex relative z-10 flex-col gap-5 sm:flex-row">
        <section
          data-aside={Boolean(aside)}
          className={`
            space-y-6 h-fit
            data-[aside=true]:sm:w-7/12
            data-[aside=false]:w-full
          `}
        >
          {content}
        </section>
        {aside && (
          <aside className="space-y-6 sm:w-5/12">
            {asideHeading && (
              <div className="text-lg sm:hidden">{asideHeading}</div>
            )}
            {aside}
          </aside>
        )}
      </div>
    </article>
  );
};

export { Article };
