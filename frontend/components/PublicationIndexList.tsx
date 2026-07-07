import { usePublication, useVisiblePublicationIds } from "modules/publication";
import { FC, MouseEvent } from "react";
import { EmptySearchResults } from "./EmptySearchResults";
import { ListSkeleton } from "./ListSkeleton";

const PublicationItem: FC<{ id: number }> = ({ id }) => {
  const publication = usePublication(id);

  return (
    publication && (
      <div className="flex justify-between mr-1 border border-gray-200 rounded-lg overflow-clip">
        <div className="p-2 space-y-4">
          <div>
            <span className="font-normal">{publication.title}</span>
            <br className="sm:hidden" />
            <span className="whitespace-nowrap"> ({publication.authors})</span>
          </div>
          <div className="text-sm text-indigo-600">
            Translation of{" "}
            <span className="font-normal">{publication.originalTitle}</span> by{" "}
            <span className="font-normal whitespace-nowrap">
              {publication.originalAuthors}
            </span>
            , published by{" "}
            <span className="font-normal">{publication.publishers}</span>
          </div>
        </div>

        <div className="p-2">
          <div>{publication.year}</div>
          <div className="ml-1 text-xs text-center">
            {publication.countries}
          </div>
        </div>
      </div>
    )
  );
};

interface Props {
  onItemClick: (id: number) => (event: MouseEvent) => void;
}

const PublicationIndexList: FC<Props> = ({ onItemClick }) => {
  const ids = useVisiblePublicationIds();

  return ids && ids.length > 0 ? (
    <ol className="space-y-4">
      {ids.map((id) => (
        <li key={id} onClick={onItemClick(id)}>
          <PublicationItem id={id} />
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
