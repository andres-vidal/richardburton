"use client";

import type { WorldMap } from "modules/world-map";
import { useFormatter, useTranslations } from "next-intl";
import { FC, memo, useMemo, useState } from "react";
import InsightSection from "./InsightSection";

/** A country with its name and its number of publications. */
type Country = { code: string; name: string; count: number };

type Props = {
  title: string;
  /** What the map shows, in a tooltip beside the title. */
  hint?: string;
  /** The outlines to draw, from `worldMap`. */
  map: WorldMap;
  /** The countries with publications, in the order they are listed. */
  countries: Country[];
};

/**
 * The bands countries are shaded in, from the fewest publications to the most.
 * A country is in the last band whose `least` its count reaches, and its shade
 * is that band's position, from 1. The colour of each shade is set by
 * `data-shade` in `styles/globals.css`.
 */
const BANDS = [
  { least: 1, name: "one" },
  { least: 2, name: "few" },
  { least: 10, name: "many" },
  { least: 100, name: "most" },
] as const;

/**
 * Returns the shade of a country with `count` publications, from 1 to 4, or
 * undefined when it has none.
 */
const shadeOf = (count: number) =>
  BANDS.filter(({ least }) => count >= least).length || undefined;

/**
 * One country on the map. A shaded country reports being hovered through
 * `onHover`, and is darkened while `active`. The outline is memoized, so a
 * hover re-renders only the countries whose `active` changes.
 */
const Outline = memo(function Outline({
  code,
  d,
  shade,
  title,
  active,
  onHover,
}: {
  code: string | null;
  d: string;
  shade?: number;
  /** The country's name and count, shown while it is hovered. */
  title?: string;
  active: boolean;
  onHover: (code: string | null) => void;
}) {
  return (
    <path
      d={d}
      data-code={shade ? code : undefined}
      data-shade={shade}
      data-active={shade ? active : undefined}
      onMouseEnter={shade ? () => onHover(code) : undefined}
      onMouseLeave={shade ? () => onHover(null) : undefined}
      className="transition-colors stroke-white stroke-[0.5] fill-[var(--shade,var(--color-gray-200))] data-[active=true]:fill-(--shade-active)"
    >
      {title ? <title>{title}</title> : null}
    </path>
  );
});

/**
 * A titled world map with each country shaded by its number of publications,
 * and a list of the countries with their counts beside it.
 *
 * The shades are fixed bands rather than a scale of the largest count, so the
 * same shade means the same range on every search: one publication, two to
 * nine, ten to 99, and 100 or more (see `BANDS`). Countries with none are
 * grey.
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
  const t = useTranslations("insights");
  const format = useFormatter();
  const [active, setActive] = useState<string | null>(null);

  const outlines = useMemo(() => {
    const counted = new Map(
      countries.map((country) => [country.code, country]),
    );

    return map.shapes.map(({ code, d }, index) => {
      const country = code ? counted.get(code) : undefined;

      return {
        key: code ?? `unnamed ${index}`,
        code,
        d,
        shade: shadeOf(country?.count ?? 0),
        title: country
          ? `${country.name} · ${format.number(country.count)}`
          : undefined,
      };
    });
  }, [map, countries, format]);

  return (
    <InsightSection title={title} hint={hint}>
      <div className="grid gap-6 items-start lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <div aria-hidden className="space-y-2">
          <svg
            viewBox={`0 0 ${map.width} ${map.height}`}
            className="w-full h-auto"
          >
            {outlines.map(({ key, ...outline }) => (
              <Outline
                key={key}
                {...outline}
                active={outline.code !== null && outline.code === active}
                onHover={setActive}
              />
            ))}
          </svg>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
            {BANDS.map(({ name }, index) => (
              <li key={name} className="flex gap-1.5 items-center">
                <span
                  data-shade={index + 1}
                  className="size-2.5 rounded-sm bg-(--shade)"
                />
                {t(`shades.${name}`)}
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
    </InsightSection>
  );
};

export default InsightMap;
