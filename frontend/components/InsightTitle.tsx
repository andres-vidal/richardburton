"use client";

import { useTranslations } from "next-intl";
import { FC } from "react";
import InfoHint from "./InfoHint";

/**
 * The heading of a chart or list of insights, followed by an `InfoHint` that
 * explains it when `hint` is given. `id` is the heading's id, which the section
 * around the chart is labelled by.
 *
 * The hint is a sibling of the heading rather than inside it, so the heading's
 * text, and the name of the section it labels, stays the title alone.
 */
const InsightTitle: FC<{ id: string; title: string; hint?: string }> = ({
  id,
  title,
  hint,
}) => {
  const t = useTranslations("insights");

  return (
    <div className="flex gap-1.5 items-center">
      <h2 id={id} className="text-lg font-normal text-gray-900">
        {title}
      </h2>
      {hint ? (
        <InfoHint label={t("about", { name: title })} message={hint} />
      ) : null}
    </div>
  );
};

export default InsightTitle;
