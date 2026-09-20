"use client";

import { useTranslations } from "next-intl";
import { FC, ReactNode } from "react";
import { Article } from "./Article";
import { Modal, useURLQueryModal } from "./Modal";

const SEARCH_HELP_MODAL_KEY = "search-help";

/** One example query and what it matches. */
const Row: FC<{ type: string; children: ReactNode }> = ({ type, children }) => (
  <tr className="border-b border-gray-100 last:border-0">
    <td className="py-1.5 pr-4 align-top">
      <code className="px-1.5 py-0.5 font-mono text-xs text-indigo-800 whitespace-nowrap bg-indigo-50 rounded">
        {type}
      </code>
    </td>
    <td className="py-1.5 text-sm text-gray-600 align-top">{children}</td>
  </tr>
);

/** A titled group of examples; the modal renders one table per group. */
const Group: FC<{ title: string; children: ReactNode }> = ({
  title,
  children,
}) => (
  <tbody>
    <tr>
      <th
        colSpan={2}
        scope="colgroup"
        className="pt-5 pb-1 text-xs font-medium tracking-wide text-left text-gray-500 uppercase"
      >
        {title}
      </th>
    </tr>
    {children}
  </tbody>
);

/**
 * The groups and their rows. Examples are written per language, so a reader
 * sees the operators they would type — `titulo:` in Portuguese — and the last
 * group offers the other language's names.
 */
const GROUPS = [
  { title: "spelling", rows: ["accents", "misspelling", "prefix"] },
  {
    title: "oneField",
    rows: [
      "titleField",
      "authorField",
      "translatorField",
      "publisherField",
      "yearField",
      "rangeField",
    ],
  },
  { title: "refining", rows: ["phrase", "allWords", "exclude", "repeat"] },
  { title: "broadening", rows: ["either"] },
  { title: "otherLanguage", rows: ["namesOne", "namesTwo", "or"] },
] as const;

/** A row's example is keyed beside its description, minus the `Field` suffix. */
const exampleKey = (row: string) => `${row.replace(/Field$/, "")}Example`;

/**
 * Documents the search syntax: accent and misspelling tolerance, per-word
 * narrowing, and the field operators. None of that is discoverable from a text
 * box.
 *
 * Every row states a query and what it matches; none describes the
 * implementation.
 */
const SearchHelp: FC = () => {
  const t = useTranslations("searchHelp");

  return (
    <div className="space-y-6">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-300">
            <th
              scope="col"
              className="py-1 pr-4 w-1/3 text-xs font-medium text-left text-gray-500"
            >
              {t("exampleHeader")}
            </th>
            <th
              scope="col"
              className="py-1 text-xs font-medium text-left text-gray-500"
            >
              {t("returnsHeader")}
            </th>
          </tr>
        </thead>

        {GROUPS.map(({ title, rows }) => (
          <Group key={title} title={t(title)}>
            {rows.map((row) => (
              <Row key={row} type={t(exampleKey(row))}>
                {t.rich(row, {
                  em: (chunks) => <em>{chunks}</em>,
                  code: (chunks) => (
                    <code className="font-mono text-xs">{chunks}</code>
                  ),
                })}
              </Row>
            ))}
          </Group>
        ))}
      </table>
    </div>
  );
};

const SearchHelpModal: FC = () => {
  const { isOpen, close } = useURLQueryModal(SEARCH_HELP_MODAL_KEY);
  const t = useTranslations("searchHelp");

  return (
    <Modal isOpen={isOpen} onClose={close} label={t("title")}>
      <Article
        heading={t("title")}
        subheading={t("subtitle")}
        content={<SearchHelp />}
      />
    </Modal>
  );
};

export { SEARCH_HELP_MODAL_KEY, SearchHelpModal };
