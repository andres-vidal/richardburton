"use client";

import type { WorldMap } from "modules/world-map";
import { useFormatter, useTranslations } from "next-intl";
import { FC, useId, useState } from "react";
import InsightTitle from "./InsightTitle";

/** A country with its name and its number of publications. */
type Counted = { code: string; name: string; count: number };

type Props = {
  title: string;
  /** What the chart shows, in a tooltip beside the title. */
  hint?: string;
  /** The outlines to draw, from `worldMap`. */
  map: WorldMap;
  /** The countries with publications, in the order they are listed. */
  countries: Counted[];
};

/**
 * Returns the shade of a country with `count` publications: 1 for one, 2 for
 * two to nine, 3 for ten to 99 and 4 for more. A country with none has no
 * shade.
 */
const shade = (count: number) =>
  count === 0
    ? undefined
    : count === 1
      ? 1
      : count < 10
        ? 2
        : count < 100
          ? 3
          : 4;

/**
 * A titled world map with each country shaded by its number of publications,
 * and a list of the countries with their counts beside it.
 *
 * The shades are fixed bands rather than a scale of the largest count, so the
 * same shade means the same range on every search: one publication, two to
 * nine, ten to 99, and 100 or more. Countries with none are grey.
 *
 * Hovering a shaded country darkens it by one shade, shows its name and count,
 * and highlights its entry in the list. Hovering an entry in the list
 * highlights it and darkens its country the same way. Both read the hovered
 * country from one piece of state, and the map and the list mark it with
 * `data-active`.
 *
 * The map is hidden from assistive technology, which reads the list.
 */
const InsightMap: FC<Props> = ({ title, hint, map, countries }) => {
  const id = useId();
  const t = useTranslations("insights");
  const format = useFormatter();

  const counts = new Map(countries.map((country) => [country.code, country]));
  const [active, setActive] = useState<string | null>(null);

  return (
    <section aria-labelledby={id} className="space-y-3">
      <InsightTitle id={id} title={title} hint={hint} />
      <div className="grid gap-6 items-start lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <div aria-hidden className="space-y-2">
          <svg
            viewBox={`0 0 ${map.width} ${map.height}`}
            className="w-full h-auto"
          >
            {map.shapes.map(({ code, d }, index) => {
              const country = code ? counts.get(code) : undefined;

              return (
                <path
                  key={code ?? index}
                  d={d}
                  data-code={country?.code}
                  data-shade={shade(country?.count ?? 0)}
                  data-active={country ? country.code === active : undefined}
                  onMouseEnter={
                    country ? () => setActive(country.code) : undefined
                  }
                  onMouseLeave={country ? () => setActive(null) : undefined}
                  className="transition-colors fill-gray-200 stroke-white stroke-[0.5] data-[shade=1]:fill-indigo-200 data-[shade=2]:fill-indigo-400 data-[shade=3]:fill-indigo-600 data-[shade=4]:fill-indigo-800 data-[shade=1]:data-[active=true]:fill-indigo-300 data-[shade=2]:data-[active=true]:fill-indigo-500 data-[shade=3]:data-[active=true]:fill-indigo-700 data-[shade=4]:data-[active=true]:fill-indigo-950"
                >
                  {country ? (
                    <title>{`${country.name} · ${format.number(country.count)}`}</title>
                  ) : null}
                </path>
              );
            })}
          </svg>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
            {(["one", "few", "many", "most"] as const).map((band, index) => (
              <li key={band} className="flex gap-1.5 items-center">
                <span
                  data-shade={index + 1}
                  className="size-2.5 rounded-sm data-[shade=1]:bg-indigo-200 data-[shade=2]:bg-indigo-400 data-[shade=3]:bg-indigo-600 data-[shade=4]:bg-indigo-800"
                />
                {t(`shades.${band}`)}
              </li>
            ))}
          </ul>
        </div>
        <ol className="space-y-0.5 max-w-xs text-sm">
          {countries.map(({ code, name, count }) => (
            <li
              key={code}
              data-active={code === active}
              onMouseEnter={() => setActive(code)}
              onMouseLeave={() => setActive(null)}
              className="flex gap-3 justify-between py-0.5 px-2 -mx-2 rounded transition-colors data-[active=true]:bg-indigo-100"
            >
              <span className="text-gray-900">{name}</span>
              <span className="text-gray-700 tabular-nums">
                {format.number(count)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default InsightMap;
export type { Counted };
