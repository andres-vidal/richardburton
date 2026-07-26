"use client";

import { Publication, type PublicationKey } from "modules/publication/model";
import Link from "next/link";
import { FC, ReactNode } from "react";
import Tooltip from "./Tooltip";

/**
 * A publication as a reader sees it: the title and its translators, a sentence
 * placing it, and its sources.
 *
 * Takes the record rather than an id, so whoever renders it decides where it
 * came from — a page reading it on the server, or an overlay opened over the
 * index. Controls go in as `actions` rather than being decided here — copying a link
 * for everyone, editing and deleting for an admin — which keeps this the same
 * view whoever is reading.
 */

const Searchable: FC<{
  label: string;
  value?: string;
  onNavigate?: () => void;
}> = ({ value, label, onNavigate }) => (
  <Link
    href={`/?search=${value || label}`}
    className="anchor"
    onClick={onNavigate}
  >
    {label}
  </Link>
);

const SearchableList: FC<{
  items: { label: string; value?: string }[];
  onNavigate?: () => void;
}> = ({ items, onNavigate }) => (
  <ul className="contents">
    {items.map((item, index) => (
      <li key={item.value} className="contents">
        {index != 0 && index === items.length - 1 && " and "}
        <Searchable {...item} onNavigate={onNavigate} />
        {index < items.length - 2 && ", "}
        {index === items.length - 1 && " "}
      </li>
    ))}
  </ul>
);

const PublicationHeading: FC<{ publication: Publication }> = ({
  publication,
}) => (
  <div className="flex flex-col w-full text-2xl font-normal sm:gap-2 sm:items-center sm:flex-row">
    <Tooltip variant="info" message="Translation's title">
      <span className="w-full truncate sm:w-min whitespace-nowrap">
        {publication.title}
      </span>
    </Tooltip>
    <Tooltip variant="info" message="Who translated this publication">
      <span className="text-lg font-light tracking-tighter text-indigo-500 sm:text-xl whitespace-nowrap">
        ({publication.authors})
      </span>
    </Tooltip>
  </div>
);

const PublicationDescription: FC<{
  publication: Publication;
  onNavigate?: () => void;
}> = ({ publication: p, onNavigate }) => {
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

  const list = (key: PublicationKey) => (
    <SearchableList
      items={getSearchableItems(p, key)}
      onNavigate={onNavigate}
    />
  );

  // A <div>, not a <p>: SearchableList renders a <ul>, which is invalid (and a
  // hydration error) nested inside a paragraph.
  return (
    <div>
      <Searchable label={p.title} onNavigate={onNavigate} /> is a translation of{" "}
      <Searchable label={p.originalTitle} onNavigate={onNavigate} />, by{" "}
      {list("originalAuthors")}. It was written by {list("authors")} and
      published in {list("countries")}
      in {p.year} by {list("publishers")}.
    </div>
  );
};

const PublicationReferences: FC<{ references: string[] }> = ({ references }) =>
  references.length === 0 ? null : (
    <section className="space-y-2">
      <h2 className="text-sm font-medium tracking-wide text-gray-500 uppercase">
        References
      </h2>
      <ul className="space-y-1.5 text-sm text-gray-700">
        {references.map((reference, index) => (
          <li key={index} className="flex gap-2.5 items-baseline">
            <span
              aria-hidden
              className="size-1.5 rounded-full shrink-0 bg-indigo-400 ring-2 ring-indigo-100"
            />
            <span className="wrap-break-words">{reference}</span>
          </li>
        ))}
      </ul>
    </section>
  );

const PublicationDetail: FC<{
  publication: Publication;
  /** Run when a search link is followed — an overlay uses it to close itself. */
  onNavigate?: () => void;
  /** Controls the caller adds beneath the record — sharing, and admin affordances. */
  actions?: ReactNode;
}> = ({ publication, onNavigate, actions }) => (
  <div className="space-y-6">
    <PublicationDescription publication={publication} onNavigate={onNavigate} />
    <PublicationReferences references={publication.references} />
    {actions}
  </div>
);

export default PublicationDetail;
export { PublicationHeading };
