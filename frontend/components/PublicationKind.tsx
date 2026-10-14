"use client";

import { Link } from "i18n/navigation";
import type {
  FollowedPublication,
  PublicationKind as Kind,
} from "modules/publication/model";
import { useFormatter, useTranslations } from "next-intl";
import { FC } from "react";
import InfoHint from "./InfoHint";

type Props = {
  /** The publication's kind. */
  kind: Kind;
  /** The publication it follows, or null for a first translation. */
  follows: FollowedPublication | null;
};

/**
 * Says that a publication is a retranslation or a reissue, in one line: a
 * badge that names the kind, an `InfoHint` that defines the kinds of
 * publication, and a sentence that links to the publication it follows. For a
 * retranslation, the sentence names the translators of the work's first
 * translation. It renders nothing for a first translation.
 *
 * The link goes to the earlier publication's own address,
 * `/publications/:id`.
 */
const PublicationKind: FC<Props> = ({ kind, follows }) => {
  const t = useTranslations("publication.kind");
  const insights = useTranslations("insights");
  const format = useFormatter();

  return follows === null ? null : (
    <p className="flex flex-wrap gap-x-2 gap-y-1 items-center text-sm text-gray-700">
      <span className="inline-flex gap-1 items-center">
        <span
          data-kind={kind}
          className={`
            px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset
            data-[kind=retranslation]:bg-amber-50 data-[kind=retranslation]:text-amber-800 data-[kind=retranslation]:ring-amber-300
            data-[kind=reissue]:bg-indigo-50 data-[kind=reissue]:text-indigo-700 data-[kind=reissue]:ring-indigo-200
          `}
        >
          {t(kind)}
        </span>
        <InfoHint
          label={t("about", { kind })}
          message={insights("hints.byDecade")}
        />
      </span>
      <span>
        {t.rich(kind === "retranslation" ? "retranslationOf" : "reissueOf", {
          translators: format.list(follows.authors),
          title: follows.title,
          year: String(follows.year),
          link: (chunks) => (
            <Link href={`/publications/${follows.id}`} className="anchor">
              {chunks}
            </Link>
          ),
        })}
      </span>
    </p>
  );
};

export default PublicationKind;
