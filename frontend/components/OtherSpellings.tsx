"use client";

import type { Name } from "modules/vocabulary";
import { useTranslations } from "next-intl";
import { FC } from "react";

/** A stored name offered as another spelling, with its publication count. */
type Spelling = Omit<Name, "resembles">;

/**
 * A line that offers other spellings of a name: `label`, then a button for
 * each of `spellings` that shows the spelling and how many publications credit
 * it. Pressing a button calls `onPick` with that spelling.
 *
 * The count tells the more common spelling apart, which is usually the one to
 * keep.
 */
const OtherSpellings: FC<{
  label: string;
  spellings: Spelling[];
  onPick: (spelling: Spelling) => void;
}> = ({ label, spellings, onPick }) => {
  const t = useTranslations("vocabulary");

  return (
    <p className="flex flex-wrap gap-1.5 items-baseline pt-2 text-xs text-amber-900">
      {label}
      {spellings.map((spelling) => (
        <button
          key={spelling.id}
          type="button"
          className="py-0.5 px-2 bg-white rounded-full border border-amber-300 hover:bg-amber-100"
          onClick={() => onPick(spelling)}
        >
          {spelling.name}{" "}
          <span className="text-amber-700 tabular-nums">
            {t("onPublications", { count: spelling.publications })}
          </span>
        </button>
      ))}
    </p>
  );
};

export default OtherSpellings;
export type { Spelling };
