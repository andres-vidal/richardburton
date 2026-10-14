import Logo from "assets/logo.svg";
import { FC, ReactNode } from "react";

interface Props {
  /** The article's `h1`, in a bar pinned to the top while the content scrolls. */
  heading: ReactNode;
  /** A line under the heading, pinned with it. */
  subheading?: ReactNode;
  content: ReactNode;
  /** A column beside the content from the `sm` breakpoint up, and under it below. */
  aside?: ReactNode;
  /**
   * The aside's heading. From the `sm` breakpoint up it sits in the pinned bar,
   * above the aside; below it, it heads the aside itself.
   */
  asideHeading?: ReactNode;
}

/**
 * Renders a long-form article with its own `p-8` padding: a heading in a bar
 * pinned to the top while the content scrolls, then the `content`, with the
 * `aside` beside it when there is one. The app's logo sits faintly behind the
 * text.
 *
 * The pinned bar spans the article's padding with negative margins, and has a
 * translucent, blurred background, so the content that scrolls under it stays
 * faintly visible.
 */
const Article: FC<Props> = ({
  content,
  heading,
  subheading,
  aside,
  asideHeading,
}) => (
  <article className="flex relative flex-col gap-5 p-8 w-full min-h-full overflow-clip">
    <Logo className="absolute z-0 lg:w-screen h-screen lg:h-auto text-indigo-700 pointer-events-none opacity-20 left-[-70%] sm:left-[-52%] -top-44 sm:-top-96 aspect-square" />

    <div className="flex sticky top-0 z-40 gap-5 -mx-8 -mt-8 px-8 pt-8 pb-2 border-b border-gray-200 backdrop-blur-xl bg-white/70">
      <div
        data-aside={Boolean(aside)}
        className="space-y-1 w-full data-[aside=true]:sm:w-7/12"
      >
        <h1 className="flex gap-2 items-center text-2xl font-normal">
          {heading}
        </h1>
        {subheading && <p className="text-sm text-gray-600">{subheading}</p>}
      </div>
      {asideHeading && (
        <div className="hidden text-lg sm:block sm:w-5/12">{asideHeading}</div>
      )}
    </div>

    <div className="flex relative z-10 flex-col gap-5 sm:flex-row">
      <section
        data-aside={Boolean(aside)}
        className="space-y-6 h-fit data-[aside=true]:sm:w-7/12 data-[aside=false]:w-full"
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

export { Article };
