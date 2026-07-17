"use client";

import { usePublication } from "modules/publication/hooks";
import { Publication, type PublicationKey } from "modules/publication/model";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { FC } from "react";
import { z } from "zod";
import { Article } from "./Article";
import { Modal, useURLQueryModal } from "./Modal";
import Tooltip from "./Tooltip";

const PUBLICATION_MODAL_KEY = "publication";

const Param = z.string().regex(/^\d+$/).transform(Number).optional();
type Param = z.infer<typeof Param>;

const Searchable: FC<{ label: string; value?: string }> = ({
  value,
  label,
}) => {
  const { close } = useURLQueryModal(PUBLICATION_MODAL_KEY);

  return (
    <Link
      href={`/?search=${value || label}`}
      className="anchor"
      onClick={close}
    >
      {label}
    </Link>
  );
};

const SearchableList: FC<{ items: { label: string; value?: string }[] }> = ({
  items,
}) => {
  const t = useTranslations("common");

  return (
    <ul className="contents">
      {items.map((item, index) => (
        <li key={item.value} className="contents">
          {index != 0 && index === items.length - 1 && ` ${t("and")} `}
          <Searchable {...item} />
          {index < items.length - 2 && ", "}
          {index === items.length - 1 && " "}
        </li>
      ))}
    </ul>
  );
};

const PublicationHeading: FC<{ publication: Publication }> = ({
  publication,
}) => {
  const t = useTranslations("publications");

  return (
    <div className="flex flex-col w-full text-2xl font-normal sm:gap-2 sm:items-center sm:flex-row">
      <Tooltip variant="info" message={t("translationTitle")}>
        <span className="w-full truncate sm:w-min whitespace-nowrap">
          {publication.title}
        </span>
      </Tooltip>

      <Tooltip variant="info" message={t("translatorTooltip")}>
        <span className="text-lg font-light tracking-tighter text-indigo-500 sm:text-xl">
          ({publication.authors})
        </span>
      </Tooltip>
    </div>
  );
};

const PublicationDescription: FC<{ publication: Publication }> = ({
  publication: p,
}) => {
  const t = useTranslations("publications");

  // `value` (not `id`): it's the field SearchableList keys on and Searchable
  // searches by. Naming it `id` left `value` undefined — a duplicate-key warning
  // and links that searched the human label (e.g. "United States of America")
  // instead of the raw value ("US").
  function getSearchableItems(p: Publication, key: PublicationKey) {
    return p[key]
      .split(",")
      .map((value) => value.trim())
      .map((value) => ({
        value,
        label: Publication.describeValue(value, key),
      }));
  }

  // A <div>, not a <p>: SearchableList renders a <ul>, which is invalid (and a
  // hydration error) nested inside a paragraph.
  return (
    <div>
      {t.rich("description", {
        title: () => <Searchable label={p.title} />,
        originalTitle: () => <Searchable label={p.originalTitle} />,
        originalAuthors: () => (
          <SearchableList
            items={getSearchableItems(p, "originalAuthors")}
          />
        ),
        authors: () => (
          <SearchableList items={getSearchableItems(p, "authors")} />
        ),
        countries: () => (
          <SearchableList items={getSearchableItems(p, "countries")} />
        ),
        publishers: () => (
          <SearchableList items={getSearchableItems(p, "publishers")} />
        ),
        year: p.year,
      })}
    </div>
  );
};

const PublicationModal: FC = () => {
  const t = useTranslations("publications");
  const { value, ...modal } = useURLQueryModal(PUBLICATION_MODAL_KEY);

  const publicationId = Param.parse(value);

  const publication = usePublication(publicationId);

  return (
    <Modal
      isOpen={modal.isOpen}
      onClose={modal.close}
      label={t("details")}
    >
      {publication && (
        <Article
          heading={<PublicationHeading publication={publication} />}
          content={<PublicationDescription publication={publication} />}
        />
      )}
    </Modal>
  );
};

export { PUBLICATION_MODAL_KEY, PublicationModal };
