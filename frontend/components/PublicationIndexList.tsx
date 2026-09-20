"use client";

import {
  usePublication,
  usePublicationMarking,
  useVisiblePublicationIds,
} from "modules/publication/hooks";
import { Publication, type PublicationKey } from "modules/publication/model";
import { useTranslations } from "next-intl";
import { FC, MouseEvent } from "react";
import { EmptySearchResults } from "./EmptySearchResults";
import { Link } from "i18n/navigation";
import Highlight from "./Highlight";
import { ListSkeleton } from "./ListSkeleton";

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

const PublicationItem: FC<{ id: number }> = ({ id }) => {
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
  onItemClick: (id: number) => (event: MouseEvent) => void;
  /** Where each record lives, so the list is a set of links and not a dead end. */
  itemHref?: (id: number) => string;
}

const PublicationIndexList: FC<Props> = ({ onItemClick, itemHref }) => {
  const ids = useVisiblePublicationIds();

  return ids && ids.length > 0 ? (
    <ol className="space-y-4">
      {ids.map((id) => (
        <li key={id} onClick={onItemClick(id)}>
          {itemHref ? (
            <Link
              href={itemHref(id)}
              onClick={(event) => event.preventDefault()}
            >
              <PublicationItem id={id} />
            </Link>
          ) : (
            <PublicationItem id={id} />
          )}
        </li>
      ))}
    </ol>
  ) : ids ? (
    <EmptySearchResults />
  ) : (
    <ListSkeleton rows={10} />
  );
};

export { PublicationIndexList };
