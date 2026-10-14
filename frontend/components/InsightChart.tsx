"use client";

import {
  cumulative,
  isTime,
  presetOf,
  type Description,
  type Form,
} from "modules/chart";
import { useCountryNaming } from "modules/country-names";
import type { Drawn, Key, Step } from "modules/insights";
import { useWorldMap } from "modules/world-map-provider";
import { useFormatter, useTranslations } from "next-intl";
import { FC, ReactNode } from "react";
import InsightBars from "./InsightBars";
import InsightColumns from "./InsightColumns";
import InsightHeat from "./InsightHeat";
import InsightLines from "./InsightLines";
import InsightMap from "./InsightMap";
import InsightSection from "./InsightSection";
import InsightStacks from "./InsightStacks";
import InsightTable from "./InsightTable";
import InsightTimeline from "./InsightTimeline";

type Props = {
  /** The chart, as the page's address describes it. */
  description: Description;
  /** Its counts, from `GET /insights`. */
  drawn: Drawn;
  /** Whether to draw the chart, or to show its counts in a table. */
  view: "chart" | "table";
  /** Controls shown at the end of the chart's title row. */
  actions?: ReactNode;
};

/** The message of each kind of publication, in the `insights` messages. */
const KINDS: Record<string, string> = {
  first_translation: "firstTranslations",
  retranslation: "retranslations",
  reissue: "reissues",
};

/**
 * The key, in the `insights.hints` messages, of the hint that says what each
 * count counts. Translations have theirs in `insights.builder.hints`.
 */
const COUNT_HINTS: Record<Description["count"], string> = {
  publications: "hints.publications",
  works: "hints.works",
  translations: "builder.hints.translations",
  original_authors: "hints.originalAuthors",
  translators: "hints.translators",
  publishers: "hints.publishers",
};

/** The most names a step's label lists. A step with more is counted instead. */
const NAMED = 3;

/**
 * A chart of `drawn`, in the form `description` names, or a table of its
 * counts when `view` is `"table"`. Each form is drawn by its component:
 *
 * - columns and shares over time: `InsightColumns`;
 * - lines, stacked areas and running totals: `InsightLines`;
 * - bars: `InsightBars` for one series and `InsightStacks` for several, which
 *   also draws shares of groups that are not years or decades;
 * - heat tables: `InsightHeat`; timelines: `InsightTimeline`; maps:
 *   `InsightMap`.
 *
 * The chart's title and hint are those of its preset when `description` is a
 * preset. Otherwise the title names what is counted, by what, and how, and
 * the hint says what the count counts, what a kind is when kinds are involved,
 * and what a first appearance is when the chart counts them.
 *
 * The component names each group from its key: decades and kinds in the
 * reader's language, countries by name, and works and pairs with their authors
 * or translator as the detail. Under the chart, it says how many groups `top`
 * left out. When there are no groups, it shows a message in the chart's place.
 *
 * `actions` are shown at the end of the chart's title row, whatever the form.
 * The component reads the map's outlines from the nearest `WorldMapProvider`.
 */
const InsightChart: FC<Props> = ({ description, drawn, view, actions }) => {
  const t = useTranslations("insights");
  const naming = useCountryNaming();
  const format = useFormatter();
  const map = useWorldMap();
  const { count, by, split, form, first } = description;
  const preset = presetOf(description);

  const base = split
    ? t("builder.splitTitle", {
        count: t(`builder.headings.${count}`),
        by: t(`builder.groupings.${by}`),
        split: t(`builder.splits.${split}`),
      })
    : t("builder.title", {
        count: t(`builder.headings.${count}`),
        by: t(`builder.groupings.${by}`),
      });

  const title = preset
    ? t(preset.name)
    : form === "running"
      ? t("builder.runningTitle", { title: base })
      : form === "shares"
        ? t("builder.sharesTitle", { title: base })
        : first
          ? t("builder.firstTitle", { title: base })
          : base;

  const hint = preset
    ? t(`hints.${preset.name}`)
    : [
        t(COUNT_HINTS[count]),
        by === "kind" || split === "kind" ? t("hints.byDecade") : null,
        by === "pair" ? t("builder.hints.pairs") : null,
        first ? t("builder.hints.first") : null,
        form === "running" ? t("builder.hints.running") : null,
        form === "shares" ? t("builder.hints.shares") : null,
      ]
        .filter(Boolean)
        .join(" ");

  const heading = t(`builder.groupingHeadings.${by}`);

  const kindOf = (kind: string) => t(KINDS[kind]);

  const series = drawn.series.map((name) =>
    split === "kind"
      ? kindOf(name ?? "")
      : split === "country"
        ? name
          ? naming.name(name)
          : t("elsewhere")
        : t(`builder.headings.${count}`),
  );

  const nameOf = (key: Key): { key: string; label: string; detail?: string } =>
    typeof key === "number"
      ? {
          key: String(key),
          label: by === "decade" ? t("decade", { decade: key }) : String(key),
        }
      : typeof key === "string"
        ? {
            key,
            label:
              by === "kind"
                ? kindOf(key)
                : by === "country"
                  ? naming.name(key)
                  : key,
          }
        : "title" in key
          ? {
              key: `${key.title} · ${key.authors.join(", ")}`,
              label: key.title,
              detail: key.authors.join(", "),
            }
          : {
              key: `${key.author} · ${key.translator}`,
              label: key.author,
              detail: key.translator,
            };

  // Describes a step as "1953 · Helen Caldwell" when it counts few enough
  // items to name them, and as "1953 · 5 publications" otherwise.
  const describe = (at: string, { total, items }: Step) =>
    `${at} · ${
      total <= NAMED
        ? items.map((names) => format.list(names)).join("; ")
        : t(`builder.counted.${count}`, { count: total })
    }`;

  const rows = drawn.groups.map((group) => ({
    ...nameOf(group.key),
    counts: group.counts,
    total: group.total,
  }));

  const timed = drawn.groups.map((group, index) => ({
    at: group.key as number,
    label: rows[index].label,
    counts: group.counts,
  }));

  const forms: Record<Form, () => ReactNode> = {
    columns: () => (
      <InsightColumns
        title={title}
        hint={hint}
        actions={actions}
        heading={heading}
        series={series}
        columns={timed}
      />
    ),
    lines: () => (
      <InsightLines
        title={title}
        hint={hint}
        actions={actions}
        heading={heading}
        series={series}
        points={timed}
      />
    ),
    area: () => (
      <InsightLines
        title={title}
        hint={hint}
        actions={actions}
        heading={heading}
        series={series}
        points={timed}
        stacked
      />
    ),
    running: () => (
      <InsightLines
        title={title}
        hint={hint}
        actions={actions}
        heading={heading}
        series={series}
        points={cumulative(timed)}
        stacked={series.length > 1}
      />
    ),
    shares: () =>
      isTime(by) ? (
        <InsightColumns
          title={title}
          hint={hint}
          actions={actions}
          heading={heading}
          series={series}
          columns={timed}
          shares
        />
      ) : (
        <InsightStacks
          title={title}
          hint={hint}
          actions={actions}
          heading={heading}
          series={series}
          rows={rows}
          shares
        />
      ),
    bars: () =>
      series.length > 1 ? (
        <InsightStacks
          title={title}
          hint={hint}
          actions={actions}
          heading={heading}
          series={series}
          rows={rows}
        />
      ) : (
        <InsightBars
          title={title}
          hint={hint}
          actions={actions}
          bars={rows.map(({ key, label, detail, total }) => ({
            key,
            label,
            detail,
            count: total,
          }))}
        />
      ),
    heat: () => (
      <InsightHeat
        title={title}
        hint={hint}
        actions={actions}
        heading={heading}
        rows={drawn.groups.map((group, index) => ({
          ...rows[index],
          cells: (group.steps ?? []).map((step) => ({
            at: step.at,
            total: step.total,
            label: describe(t("decade", { decade: step.at }), step),
          })),
        }))}
      />
    ),
    timeline: () => (
      <InsightTimeline
        title={title}
        hint={hint}
        actions={actions}
        tracks={drawn.groups.map((group, index) => ({
          ...rows[index],
          value: t(`builder.counted.${count}`, { count: group.total }),
          marks: (group.steps ?? []).map((step) => ({
            year: step.at,
            weight: step.total,
            label: describe(String(step.at), step),
          })),
        }))}
      />
    ),
    map: () => (
      <InsightMap
        title={title}
        hint={hint}
        actions={actions}
        map={map}
        countries={drawn.groups.map((group, index) => ({
          code: String(group.key),
          name: rows[index].label,
          count: group.total,
        }))}
      />
    ),
  };

  return (
    <div className="space-y-2">
      {drawn.groups.length === 0 ? (
        <InsightSection title={title} hint={hint} actions={actions}>
          <p className="text-sm text-gray-600">{t("builder.empty")}</p>
        </InsightSection>
      ) : view === "table" ? (
        <InsightSection title={title} hint={hint} actions={actions}>
          <InsightTable
            title={title}
            heading={heading}
            series={series}
            rows={form === "running" ? cumulative(rows) : rows}
            shown
          />
        </InsightSection>
      ) : (
        forms[form]()
      )}
      {drawn.hidden > 0 ? (
        <p className="text-xs text-gray-600">
          {t("builder.hidden", { count: drawn.hidden })}
        </p>
      ) : null}
    </div>
  );
};

export default InsightChart;
