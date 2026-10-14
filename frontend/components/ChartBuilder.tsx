"use client";

import {
  COUNTS,
  GROUPINGS,
  LEASTS,
  PRESETS,
  SPLITS,
  TOPS,
  descriptionParams,
  formsFor,
  groups,
  isCut,
  normalize,
  presetOf,
  splits,
  splitsBy,
  type Description,
} from "modules/chart";
import type { Drawn } from "modules/insights";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FC, useOptimistic, useState, useTransition } from "react";
import Button from "./Button";
import CopyLink from "./CopyLink";
import InsightChart from "./InsightChart";
import Select from "./Select";

type Props = {
  /** The chart the page's address describes. */
  description: Description;
  /** Its counts, from `GET /insights`. */
  drawn: Drawn;
};

/**
 * A `Select` for one control of `ChartBuilder`. Its options name themselves,
 * such as "by decade", so `label` is its accessible name rather than text on
 * screen. Typing in it filters its options by their text. `control` names the
 * control, which sets its width, so the controls keep their places whatever
 * they show.
 */
function Choice<Value extends string>({
  control,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  control: "preset" | "count" | "by" | "split" | "form" | "top" | "least";
  label: string;
  value: Value;
  /** Each option's value and text, in order. */
  options: [Value, string][];
  onChange: (value: Value) => void;
  disabled?: boolean;
}) {
  const choices = options.map(([option, text]) => ({
    id: option,
    label: text,
  }));

  return (
    <span
      data-control={control}
      className="shrink-0 data-[control=preset]:w-72 data-[control=count]:w-44 data-[control=by]:w-60 data-[control=split]:w-48 data-[control=form]:w-56 data-[control=top]:w-28 data-[control=least]:w-36"
    >
      <Select
        aria-label={label}
        bordered
        error=""
        disabled={disabled}
        value={choices.find((choice) => choice.id === value)}
        onChange={(choice) => onChange(choice.id as Value)}
        getOptions={async (search) =>
          choices.filter((choice) =>
            choice.label.toLowerCase().includes(search),
          )
        }
      />
    </span>
  );
}

/**
 * The chart builder of the insights page: a toolbar of the controls that say
 * what a chart shows, and the chart itself, drawn by `InsightChart` right
 * under it, with the controls that refine it in its title row.
 *
 * The toolbar has the presets, in a `Select` that shows the preset the chart
 * is, or "Custom" when it is none, and then what to count, by what, split by
 * what, and in which form. Choosing a preset sets every control to its chart.
 * Only the groupings and splits the count can take are offered (see `groups`
 * and `splitsBy` in `modules/chart`): publications take them all, and the
 * other counts take the names listed for them and time, with no split. A form
 * is offered only for the groupings and counts it can draw, so the map is
 * offered only for publications by country, and the split is disabled for a
 * form that draws no series and for a count that takes no split.
 *
 * The chart's title row has how many groups to keep and how many items each
 * needs, which are disabled unless the chart keeps only some of its groups
 * (see `isCut`). After them, two buttons switch between the chart and a table
 * of its counts, and `CopyLink` copies the address of the chart.
 *
 * Every control is always shown, at a fixed width, so changing one does not
 * move the others. On screens from the `md` breakpoint, the toolbar stays
 * pinned under the page's header while the chart scrolls.
 *
 * Each change writes the chart to the page's address, keeping the search, in
 * a transition. The new chart is read on the server, and the controls show the
 * new choice at once through `useOptimistic`. The current chart stays on
 * screen, dimmed, until the new one arrives. Every change goes through
 * `normalize`, so the address always describes a chart that can be drawn.
 */
const ChartBuilder: FC<Props> = ({ description, drawn }) => {
  const t = useTranslations("insights.builder");
  const titles = useTranslations("insights");
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const search = useSearchParams()?.get("search");
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(description);
  const [view, setView] = useState<"chart" | "table">("chart");
  const preset = presetOf(shown);

  const href = (next: Description) =>
    `${pathname}?${new URLSearchParams({
      ...(search ? { search } : {}),
      ...descriptionParams(next),
    })}`;

  const change = (changes: Partial<Description>) => {
    const next = normalize({ ...shown, ...changes });

    startTransition(() => {
      setShown(next);
      router.replace(href(next), { scroll: false });
    });
  };

  const refinements = (
    <>
      <Choice
        control="top"
        label={t("labels.top")}
        disabled={!isCut(shown)}
        value={String(shown.top ?? "all")}
        options={[
          ...TOPS.map(
            (top) => [String(top), t(`topOptions.${top}`)] as [string, string],
          ),
          ["all", t("topOptions.all")],
        ]}
        onChange={(top) =>
          change({ top: TOPS.find((each) => String(each) === top) ?? null })
        }
      />
      <Choice
        control="least"
        label={t("labels.least")}
        disabled={!isCut(shown)}
        value={String(shown.least ?? 0)}
        options={[0, ...LEASTS].map((least) => [
          String(least),
          t("leastOption", { least }),
        ])}
        onChange={(least) =>
          change({
            least: LEASTS.find((each) => String(each) === least) ?? null,
          })
        }
      />
      <span role="group" aria-label={t("view")} className="flex gap-1">
        {(["chart", "table"] as const).map((each) => (
          <Button
            key={each}
            label={t(each)}
            variant={view === each ? "primary" : "outline"}
            aria-pressed={view === each}
            onClick={() => setView(each)}
            size="field"
            width="fit"
          />
        ))}
      </span>
      <CopyLink href={href(shown)} />
    </>
  );

  return (
    <div className="space-y-4">
      <section
        aria-label={t("label")}
        className="z-20 py-2 px-1 -mx-1 bg-gray-100 border-y border-gray-200 md:sticky md:px-8 md:-mx-8 md:top-(--app-header-h)"
      >
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <Choice
            control="preset"
            label={t("labels.preset")}
            value={preset?.name ?? "custom"}
            options={[
              ...(preset ? [] : [["custom", t("custom")] as [string, string]]),
              ...PRESETS.map(
                ({ name }) => [name, titles(name)] as [string, string],
              ),
            ]}
            onChange={(name) =>
              change(
                PRESETS.find((each) => each.name === name)?.description ?? {},
              )
            }
          />
          <span aria-hidden className="mx-1 w-px h-6 bg-gray-300" />
          <Choice
            control="count"
            label={t("labels.count")}
            value={shown.count}
            options={COUNTS.map((count) => [count, t(`headings.${count}`)])}
            onChange={(count) => change({ count })}
          />
          <Choice
            control="by"
            label={t("labels.by")}
            value={shown.by}
            options={GROUPINGS.filter((by) =>
              groups({ count: shown.count, by }),
            ).map((by) => [by, t("byOption", { by: t(`groupings.${by}`) })])}
            onChange={(by) => change({ by })}
          />
          <Choice
            control="split"
            label={t("labels.split")}
            disabled={
              !splits(shown.form) ||
              !SPLITS.some((split) => splitsBy(shown, split))
            }
            value={shown.split ?? "none"}
            options={[
              ["none", t("splitOptions.none")],
              ...SPLITS.filter((split) => splitsBy(shown, split)).map(
                (split) =>
                  [split, t(`splitOptions.${split}`)] as [string, string],
              ),
            ]}
            onChange={(split) =>
              change({ split: SPLITS.find((each) => each === split) ?? null })
            }
          />
          <Choice
            control="form"
            label={t("labels.form")}
            value={shown.form}
            options={formsFor(shown).map((form) => [
              form,
              t("formOption", { form: t(`forms.${form}`) }),
            ])}
            onChange={(form) =>
              change({
                form,
                ...(form === "shares" && !shown.split
                  ? { split: "kind" as const }
                  : {}),
              })
            }
          />
        </div>
      </section>
      <div
        data-pending={pending}
        className="transition-opacity data-[pending=true]:opacity-50"
      >
        <InsightChart
          description={description}
          drawn={drawn}
          view={view}
          actions={refinements}
        />
      </div>
    </div>
  );
};

export default ChartBuilder;
