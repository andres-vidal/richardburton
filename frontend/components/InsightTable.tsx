"use client";

import { useFormatter, useTranslations } from "next-intl";
import { FC } from "react";

/** One row of the table, such as a year or a decade. */
type Row = {
  key: string;
  label: string;
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
};

/**
 * A visually hidden table of the counts a chart draws: one row for each entry
 * in `rows`, with its label, its count in each series and its total. Assistive
 * technology reads it in place of the chart, which is hidden from it.
 *
 * The table is hidden inside a `sr-only` block rather than being `sr-only`
 * itself, because a table does not clip its rows with `overflow`, and a long
 * table would still make the page taller.
 */
const InsightTable: FC<Props> = ({ title, heading, series, rows }) => {
  const t = useTranslations("insights");
  const format = useFormatter();

  return (
    <div className="sr-only">
      <table>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{heading}</th>
            {series.map((name) => (
              <th key={name} scope="col">
                {name}
              </th>
            ))}
            <th scope="col">{t("total")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, counts }) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              {counts.map((count, index) => (
                <td key={index}>{format.number(count)}</td>
              ))}
              <td>{format.number(counts.reduce((a, b) => a + b, 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InsightTable;
export type { Row };
