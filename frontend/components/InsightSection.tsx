"use client";

import { useTranslations } from "next-intl";
import { FC, ReactNode, useId } from "react";
import InfoHint from "./InfoHint";

/**
 * A titled section of the insights page: a heading, an `InfoHint` after it
 * that explains the section when `hint` is given, and then `children`. The
 * section is labelled by its heading, so its accessible name is `title`.
 *
 * The hint is a sibling of the heading rather than inside it, so the heading's
 * text, and the name of the section it labels, stays the title alone.
 */
const InsightSection: FC<{
  title: string;
  /** What the section shows, in a tooltip beside the title. */
  hint?: string;
  children: ReactNode;
}> = ({ title, hint, children }) => {
  const id = useId();
  const t = useTranslations("insights");

  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex gap-1.5 items-center">
        <h2 id={id} className="text-lg font-normal text-gray-900">
          {title}
        </h2>
        {hint ? (
          <InfoHint label={t("about", { name: title })} message={hint} />
        ) : null}
      </div>
      {children}
    </section>
  );
};

export default InsightSection;
