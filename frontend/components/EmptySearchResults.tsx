import { FC } from "react";

const EmptySearchResults: FC = () => {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="flex flex-col items-center justify-center sm:pb-32 group">
        <div className="h-56 m-8 border-2 border-gray-300 rounded-2xl aspect-square group-hover:border-indigo-200" />
        <span className="text-xl text-gray-600 group-hover:text-indigo-500">
          No results found, try another query.
        </span>
      </div>
    </div>
  );
};

export { EmptySearchResults };
