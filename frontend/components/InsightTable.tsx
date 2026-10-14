"use client";

import { total } from "modules/insights";
import { useFormatter, useTranslations } from "next-intl";
import { FC } from "react";

/** One row of the table, such as a year or a decade. */
type Row = {
  key: string;
  label: string;
  /** Extra text shown after the label, such as a work's authors. */
  detail?: string;
  /** The count of each series, in the order of `series`. */
  counts: number[];
};

type Props = {
  /** The table's caption, which is the title of the chart it stands for. */
  title: string;
  /** The heading of the first column, such as "Year". */
  heading: string;
  series: string[];
  rows: Row[];
  /**
   * Whether the table is on screen. A table that is not shown is still read by
   * assistive technology.
   */
  shown?: boolean;
};

/**
 * A table of the counts a chart draws: one row for each entry in `rows`, with
 * its label, its count in each series and its total. A chart with one series
 * shows only the total.
 *
 * Unless `shown`, the table is visually hidden, and assistive technology reads
 * it in place of the chart, which is hidden from it. It is hidden inside a
 * `sr-only` block rather than being `sr-only` itself, because a table does not
 * clip its rows with `overflow`, and a long table would still make the page
 * taller.
 */
const InsightTable: FC<Props> = ({
  title,
  heading,
  series,
  rows,
  shown = false,
}) => {
  const t = useTranslations("insights");
  const format = useFormatter();
  const many = series.length > 1;

  return (
    <div
      data-shown={shown}
      className="overflow-x-auto data-[shown=false]:sr-only"
    >
      <table className="min-w-full text-sm tabular-nums">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr className="border-b border-gray-300 text-left text-xs text-gray-600">
            <th scope="col" className="py-1.5 pr-4 font-normal">
              {heading}
            </th>
            {many
              ? series.map((name) => (
                  <th
                    key={name}
                    scope="col"
                    className="py-1.5 px-4 font-normal text-right"
                  >
                    {name}
                  </th>
                ))
              : null}
            <th scope="col" className="py-1.5 pl-4 font-normal text-right">
              {t("total")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, detail, counts }) => (
            <tr key={key} className="border-b border-gray-100">
              <th
                scope="row"
                className="py-1.5 pr-4 font-normal text-left text-gray-900"
              >
                {label}
                {detail ? (
                  <span className="text-gray-600"> · {detail}</span>
                ) : null}
              </th>
              {many
                ? counts.map((count, index) => (
                    <td key={index} className="py-1.5 px-4 text-right">
                      {format.number(count)}
                    </td>
                  ))
                : null}
              <td className="py-1.5 pl-4 text-right text-gray-900">
                {format.number(total(counts))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InsightTable;
export type { Row };
