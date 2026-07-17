import { useTranslations } from "next-intl";
import { FC } from "react";

const EmptySearchResults: FC = () => {
  const t = useTranslations("search");

  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="flex flex-col items-center justify-center group">
        <svg
          aria-hidden
          viewBox="0 0 200 140"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mx-8 w-72 text-gray-300 group-hover:stroke-indigo-300"
        >
          <line x1="28" y1="100" x2="172" y2="100" />
          <rect x="46" y="54" width="15" height="46" rx="2" />
          <rect x="64" y="42" width="15" height="58" rx="2" />
          <rect x="82" y="64" width="15" height="36" rx="2" />
          <rect
            x="140"
            y="52"
            width="15"
            height="48"
            rx="2"
            transform="rotate(13 147 100)"
            className="stroke-indigo-600"
          />
        </svg>

        <span className="text-xl text-gray-600 group-hover:text-indigo-600">
          {t("noResults")}
        </span>
      </div>
    </div>
  );
};

export { EmptySearchResults };
