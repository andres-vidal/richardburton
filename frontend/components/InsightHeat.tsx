"use client";

import { useFormatter, useTranslations } from "next-intl";
import { FC, ReactNode } from "react";
import InsightSection from "./InsightSection";

/** A decade within a row, with what the row counts in it. */
type Cell = {
  /** The first year of the decade. */
  at: number;
  total: number;
  /** What the cell counts, such as "3 publications: …", shown on hover. */
  label: string;
};

/** One row of the table, such as an author. */
type HeatRow = {
  key: string;
  label: string;
  /** Extra text shown after the label, such as a work's authors. */
  detail?: string;
  /** The decades that have a count, in any order. */
  cells: Cell[];
};

type Props = {
  title: string;
  /** What the table shows, in a tooltip beside the title. */
  hint?: string;
  /** Controls shown at the end of the title's row. */
  actions?: ReactNode;
  /** The heading of the first column, such as "Original author". */
  heading: string;
  rows: HeatRow[];
};

/**
 * Returns the band of a count from 1 to 4, relative to the largest count in
 * the table, or undefined for a count of 0. The colour of each band is set by
 * `data-shade` in `styles/globals.css`.
 */
const shadeOf = (count: number, most: number) =>
  count > 0 ? Math.ceil((count / most) * 4) : undefined;

/**
 * A titled table with a row for each entry in `rows` and a column for every
 * decade from the earliest cell to the latest. Each cell shows its count and
 * is shaded by it, in four bands relative to the largest count. A decade with
 * no count is left blank.
 *
 * Hovering a cell shows its label in the browser's tooltip, from its `title`.
 * The table scrolls sideways within the section on a narrow screen, and a
 * tooltip drawn inside it would be cut off at its edges. Assistive technology
 * reads the table as a table, so it needs no other text in its place.
 */
const InsightHeat: FC<Props> = ({ title, hint, actions, heading, rows }) => {
  const t = useTranslations("insights");
  const format = useFormatter();
  const ats = rows.flatMap(({ cells }) => cells.map(({ at }) => at));
  const first = Math.min(...ats);
  const decades = ats.length
    ? Array.from(
        { length: (Math.max(...ats) - first) / 10 + 1 },
        (_, index) => first + index * 10,
      )
    : [];
  const most = Math.max(
    1,
    ...rows.flatMap(({ cells }) => cells.map(({ total }) => total)),
  );

  return (
    <InsightSection title={title} hint={hint} actions={actions}>
      <div className="overflow-x-auto">
        <table className="text-xs tabular-nums border-separate border-spacing-0.5">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="text-gray-600">
              <th scope="col" className="pr-3 font-normal text-left">
                {heading}
              </th>
              {decades.map((decade) => (
                <th
                  key={decade}
                  scope="col"
                  className="px-1 font-normal text-center whitespace-nowrap"
                >
                  {t("decade", { decade })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, label, detail, cells }) => {
              const at = new Map(cells.map((cell) => [cell.at, cell]));

              return (
                <tr key={key}>
                  <th
                    scope="row"
                    className="py-1 pr-3 max-w-56 text-sm font-normal text-left text-gray-900"
                  >
                    {label}
                    {detail ? (
                      <span className="text-gray-600"> · {detail}</span>
                    ) : null}
                  </th>
                  {decades.map((decade) => {
                    const cell = at.get(decade);

                    return (
                      <td
                        key={decade}
                        title={cell?.label}
                        data-shade={
                          cell ? shadeOf(cell.total, most) : undefined
                        }
                        className="px-1 min-w-10 h-7 text-center text-gray-900 rounded-sm bg-(--shade,var(--color-gray-50)) data-[shade=3]:text-white data-[shade=4]:text-white"
                      >
                        {cell ? format.number(cell.total) : ""}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </InsightSection>
  );
};

export default InsightHeat;
export type { HeatRow };
