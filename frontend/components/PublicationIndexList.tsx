"use client";

import {
  usePublication,
  usePublicationMarking,
  usePublicationIds,
} from "modules/publication/hooks";
import {
  Publication,
  type PublicationId,
  type PublicationKey,
} from "modules/publication/model";
import { useTranslations } from "next-intl";
import { FC, memo, MouseEvent, useRef, useState } from "react";
import useVisible from "utils/useVisible";
import { EmptySearchResults } from "./EmptySearchResults";
import { Link } from "i18n/navigation";
import Highlight from "./Highlight";
import { PublicationIndexListSkeleton } from "./PublicationIndexListSkeleton";

/** A field of the record as the index marked it, for the sentence below. */
const Marked: FC<{ publication: Publication; attribute: PublicationKey }> = ({
  publication,
  attribute,
}) => {
  const marked = usePublicationMarking();

  return (
    <span className="font-normal">
      <Highlight>{marked.value(publication, attribute)}</Highlight>
    </span>
  );
};

/**
 * The saved publication `id` as a card: its title and translators, a line
 * about its original book and publishers, and its year and countries. It
 * renders nothing when there is no saved publication.
 */
const PublicationItem: FC<{ id: PublicationId }> = ({ id }) => {
  const t = useTranslations("publication");
  const marked = usePublicationMarking();
  const publication = usePublication(id);

  return (
    publication && (
      <div className="flex justify-between mr-1 border border-gray-200 rounded-lg overflow-clip">
        <div className="p-2 space-y-4">
          <div>
            <span className="font-normal">
              <Highlight>{marked.value(publication, "title")}</Highlight>
            </span>
            <br className="sm:hidden" />
            <span className="whitespace-nowrap">
              {" "}
              (<Highlight>{marked.value(publication, "authors")}</Highlight>)
            </span>
          </div>
          <div className="text-sm text-indigo-600">
            {t.rich("summary", {
              originalTitle: () => (
                <Marked publication={publication} attribute="originalTitle" />
              ),
              originalAuthors: () => (
                <Marked publication={publication} attribute="originalAuthors" />
              ),
              publishers: () => (
                <Marked publication={publication} attribute="publishers" />
              ),
            })}
          </div>
        </div>

        <div className="p-2">
          <div>{publication.year}</div>
          <div className="ml-1 text-xs text-center">
            <Highlight>{marked.value(publication, "countries")}</Highlight>
          </div>
        </div>
      </div>
    )
  );
};

interface Props {
  /** Called with the id of the publication that was clicked. */
  onItemClick: (id: PublicationId, event: MouseEvent) => void;
  /** Where each record lives, so the list is a set of links and not a dead end. */
  itemHref?: (id: PublicationId) => string;
}

/** How far outside the viewport an entry starts to draw its publication. */
const DRAW_MARGIN = "800px 0px";

/**
 * One entry of the list. It draws the publication `id` once the entry comes
 * within `DRAW_MARGIN` of the viewport, and keeps it drawn from then on. Until
 * then the entry is an empty box of about an entry's height. The publication
 * links to `itemHref(id)` when `itemHref` is given.
 *
 * An entry under `display: none` never comes into view, so a list that a
 * breakpoint hides draws no publications. An entry is never emptied again, so
 * its height changes only once, usually before it scrolls into view.
 */
const Entry = memo(function Entry({
  id,
  onItemClick,
  itemHref,
}: Props & { id: PublicationId }) {
  const ref = useRef<HTMLLIElement>(null);
  const visible = useVisible(ref, DRAW_MARGIN);
  const [drawn, setDrawn] = useState(false);

  if (visible && !drawn) setDrawn(true);

  return (
    <li
      ref={ref}
      data-drawn={drawn}
      className="data-[drawn=false]:min-h-28"
      onClick={(event) => onItemClick(id, event)}
    >
      {drawn ? (
        itemHref ? (
          <Link href={itemHref(id)} onClick={(event) => event.preventDefault()}>
            <PublicationItem id={id} />
          </Link>
        ) : (
          <PublicationItem id={id} />
        )
      ) : null}
    </li>
  );
});

/**
 * The publications of the enclosing store as a list of entries, each one the
 * publication's title, translators, original book, publishers, year and
 * countries. Each entry draws its publication only once it nears the viewport,
 * as `Entry` describes. The list shows `EmptySearchResults` when the store
 * holds no publications, and a `PublicationIndexListSkeleton` while it has not
 * loaded them yet.
 */
const PublicationIndexList: FC<Props> = ({ onItemClick, itemHref }) => {
  const ids = usePublicationIds();

  return ids && ids.length > 0 ? (
    <ol className="space-y-4">
      {ids.map((id) => (
        <Entry key={id} id={id} onItemClick={onItemClick} itemHref={itemHref} />
      ))}
    </ol>
  ) : ids ? (
    <EmptySearchResults />
  ) : (
    <PublicationIndexListSkeleton />
  );
};

export { PublicationIndexList };
