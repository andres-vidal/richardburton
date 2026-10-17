"use client";

import { Link } from "i18n/navigation";
import { useCountryNaming } from "modules/country-names";
import type {
  FollowedPublication,
  PublicationKind as Kind,
} from "modules/publication/model";
import { useFormatter, useTranslations } from "next-intl";
import { FC, ReactNode } from "react";
import InfoHint from "./InfoHint";

type Props = {
  /** The publication's kind. */
  kind: Kind;
  /** The publications it follows, none for a first translation. */
  follows: FollowedPublication[];
};

type FollowedProps = {
  /** The kind of the publication that follows `followed`. */
  kind: Kind;
  /** One publication that the publication follows. */
  followed: FollowedPublication;
};

/** Renders `children` as a link to the publication `id`, `/publications/:id`. */
const FollowedLink: FC<{ id: number; children: ReactNode }> = ({
  id,
  children,
}) => (
  <Link href={`/publications/${id}`} className="anchor">
    {children}
  </Link>
);

/**
 * The sentence about the one publication that a retranslation or a reissue
 * follows. It links the publication's title and year. For a retranslation, it
 * also names the publication's translators.
 */
const FollowsOne: FC<FollowedProps> = ({ kind, followed }) => {
  const t = useTranslations("publication.kind");
  const format = useFormatter();

  return t.rich(kind === "retranslation" ? "retranslationOf" : "reissueOf", {
    translators: format.list(followed.authors),
    title: followed.title,
    year: String(followed.year),
    link: (chunks) => <FollowedLink id={followed.id}>{chunks}</FollowedLink>,
  });
};

/**
 * One of several followed publications, as an item of the list that
 * `FollowsSeveral` renders. The item links the publication's title with its
 * publishers and the names of its countries, which tell apart publications of
 * the same title. For a retranslation, the item also names the publication's
 * translators.
 */
const FollowedEdition: FC<FollowedProps> = ({ kind, followed }) => {
  const t = useTranslations("publication.kind");
  const format = useFormatter();
  const naming = useCountryNaming();

  return t.rich(
    kind === "retranslation" ? "retranslatedEdition" : "reissuedEdition",
    {
      translators: format.list(followed.authors),
      title: followed.title,
      publishers: format.list(followed.publishers),
      countries: format.list(followed.countries.map(naming.name)),
      link: (chunks) => <FollowedLink id={followed.id}>{chunks}</FollowedLink>,
    },
  );
};

/**
 * The sentence about the several publications that a retranslation or a
 * reissue follows, which are all of one year. It names the year once, and then
 * lists the publications with `FollowedEdition`.
 */
const FollowsSeveral: FC<{ kind: Kind; follows: FollowedPublication[] }> = ({
  kind,
  follows,
}) => {
  const t = useTranslations("publication.kind");
  const format = useFormatter();

  return t.rich(
    kind === "retranslation" ? "retranslationOfSeveral" : "reissueOfSeveral",
    {
      year: String(follows[0].year),
      editions: () =>
        format.list(
          follows.map((followed) => (
            <FollowedEdition
              key={followed.id}
              kind={kind}
              followed={followed}
            />
          )),
        ),
    },
  );
};

/**
 * Says that a publication is a retranslation or a reissue, in one line: a
 * badge that names the kind, an `InfoHint` that defines the kinds of
 * publication, and a sentence that links to each publication it follows. It
 * renders nothing for a first translation.
 *
 * With one followed publication, the sentence names its title and year, and
 * for a retranslation its translators. Several followed publications are all
 * of one year, which the sentence names once. It then names each one's title
 * with its publishers and countries, and for a retranslation its translators.
 *
 * Each link goes to the followed publication's own address,
 * `/publications/:id`.
 */
const PublicationKind: FC<Props> = ({ kind, follows }) => {
  const t = useTranslations("publication.kind");
  const insights = useTranslations("insights");

  return follows.length === 0 ? null : (
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
        {follows.length === 1 ? (
          <FollowsOne kind={kind} followed={follows[0]} />
        ) : (
          <FollowsSeveral kind={kind} follows={follows} />
        )}
      </span>
    </p>
  );
};

export default PublicationKind;
