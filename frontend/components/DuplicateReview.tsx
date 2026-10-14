"use client";

import type { Distinction, DuplicateCluster } from "app/publications/read";
import Button from "components/Button";
import { useCountryNaming } from "modules/country-names";
import {
  contrast,
  type Contrast,
  type ContrastedKey,
  Publication,
} from "modules/publication/model";
import { distinguish, merge, reconsider } from "modules/publication/remote";
import {
  PublicationStoreProvider,
  usePublicationStore,
} from "modules/publication/workspace";
import { Link } from "i18n/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { FC, Fragment, ReactNode, useState } from "react";
import { useMutation } from "utils/useMutation";
import QueueListbox, { QueueHeading } from "./QueueListbox";

/** What a cluster is called in the queue: the title its records nearly share. */
const name = (cluster: DuplicateCluster) =>
  cluster.publications[0]?.title ?? "";

/** Returns a key that names a cluster or a decision by its records. */
const recordsKey = ({ publications }: { publications: Publication[] }) =>
  publications.map((p) => p.id).join("-");

/**
 * The queue of clusters, as a `QueueListbox`. Each option shows the cluster's
 * title and how many records it has.
 *
 * The decisions already made, `distinctions`, are listed under the queue, each
 * as a button that opens it. The section is absent when there are none. While
 * a decision is open (`selected` is its position), no cluster is selected.
 */
export const DuplicateQueue: FC<{
  clusters: DuplicateCluster[];
  distinctions: Distinction[];
  position: number;
  selected: number | null;
  onSelect: (position: number) => void;
  onSelectRuledApart: (position: number) => void;
}> = ({
  clusters,
  distinctions,
  position,
  selected,
  onSelect,
  onSelectRuledApart,
}) => {
  const t = useTranslations("duplicates");

  return (
    <QueueListbox
      heading={t("possible")}
      count={clusters.length}
      label={t("clusters")}
      items={clusters}
      itemKey={recordsKey}
      renderOption={(cluster) => (
        <>
          <span className="truncate grow">{name(cluster)}</span>
          <span className="text-xs text-gray-600 shrink-0 tabular-nums">
            {cluster.publications.length}
          </span>
        </>
      )}
      position={selected === null ? position : -1}
      onSelect={onSelect}
    >
      {distinctions.length > 0 && (
        <div className="flex flex-col border-t border-gray-200 max-h-64 shrink-0">
          <QueueHeading
            heading={t("ruledApartHeading")}
            count={distinctions.length}
            quiet
          />
          <ul
            aria-label={t("ruledApart")}
            className="overflow-y-auto p-2 space-y-0.5 min-h-0 scrollbar scrollbar-thin scrollbar-thumb-indigo-600"
          >
            {distinctions.map((distinction, index) => (
              <li key={recordsKey(distinction)}>
                <button
                  type="button"
                  onClick={() => onSelectRuledApart(index)}
                  data-active={selected === index}
                  className="px-3 py-2 w-full text-sm text-left rounded transition-colors cursor-pointer truncate hover:bg-gray-100 data-[active=true]:bg-indigo-100 data-[active=true]:text-indigo-900 focus-ring"
                >
                  {distinction.publications[0]?.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </QueueListbox>
  );
};

/**
 * Renders one field as `contrast` compared it, with each stretch that differs
 * in a `<mark>`. Several values are joined as a list in the reader's language,
 * or with `separator` when it is given. An empty field reads "None", marked
 * when another record fills that field.
 *
 * `label` turns a stored value into the text shown for it, such as a country
 * code into the country's name.
 */
const Compared: FC<{
  contrast: Contrast;
  label?: (text: string) => string;
  separator?: string;
}> = ({ contrast, label = (text) => text, separator }) => {
  const t = useTranslations("duplicates");
  const format = useFormatter();

  const values = contrast.values.map((stretches, index) => (
    <Fragment key={index}>
      {stretches.map((stretch, position) =>
        stretch.differs ? (
          <mark key={position} className="text-inherit bg-amber-100">
            {label(stretch.text)}
          </mark>
        ) : (
          label(stretch.text)
        ),
      )}
    </Fragment>
  ));

  const joined: ReactNode = separator
    ? values.flatMap((value, index) =>
        index === 0 ? [value] : [separator, value],
      )
    : format.list(values, { style: "long", type: "unit" });

  return values.length > 0 ? (
    <>{joined}</>
  ) : contrast.lacking ? (
    <mark className="text-inherit bg-amber-100">{t("none")}</mark>
  ) : (
    <>{t("none")}</>
  );
};

/**
 * One record as a card: its title, year, translators, original work,
 * countries, publishers and sources, and a link to its page when it is stored.
 * With `onKeep`, the card is also a radio button that chooses the record to
 * keep, and `kept` marks the chosen one.
 *
 * Each field is compared with the same field of `others`, and the words this
 * record has that at least one of them lacks are highlighted. Without `others`,
 * nothing is highlighted.
 */
export const Candidate: FC<{
  publication: Publication;
  others?: Publication[];
  kept?: boolean;
  onKeep?: () => void;
}> = ({ publication: p, others = [], kept = false, onKeep }) => {
  const t = useTranslations("duplicates");
  const attribute = useTranslations("attributes");
  const naming = useCountryNaming();
  const field = (key: ContrastedKey) => contrast(p, others, key);

  return (
    <label
      data-kept={kept}
      data-choosable={Boolean(onKeep)}
      className="flex flex-col gap-2 p-4 rounded-lg border transition-colors data-[choosable=true]:cursor-pointer data-[kept=true]:border-indigo-400 data-[kept=true]:bg-indigo-50 data-[kept=false]:border-gray-200 data-[choosable=true]:data-[kept=false]:hover:bg-gray-50"
    >
      <div className="flex gap-3 items-start">
        {onKeep && (
          <input
            type="radio"
            name="survivor"
            checked={kept}
            onChange={onKeep}
            className="mt-1 accent-indigo-600"
            aria-label={t("keep", { title: p.title })}
          />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium">
            <Compared contrast={field("title")} />{" "}
            <span className="font-normal text-gray-600">
              (<Compared contrast={field("year")} />)
            </span>
          </p>
          <p className="text-xs text-gray-600">
            <Compared contrast={field("authors")} />
          </p>
          {typeof p.id !== "number" ? null : (
            <Link
              href={`/publications/${p.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-1 text-xs anchor"
            >
              {t("openRecord")}
            </Link>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-gray-600">{t("originalWork")}</dt>
        <dd className="text-gray-800">
          {t.rich("originalLine", {
            title: () => <Compared contrast={field("originalTitle")} />,
            authors: () => <Compared contrast={field("originalAuthors")} />,
          })}
        </dd>
        <dt className="text-gray-600">{attribute("countries")}</dt>
        <dd className="text-gray-800">
          <Compared contrast={field("countries")} label={naming.name} />
        </dd>
        <dt className="text-gray-600">{attribute("publishers")}</dt>
        <dd className="text-gray-800">
          <Compared contrast={field("publishers")} />
        </dd>
        <dt className="text-gray-600">{attribute("sources")}</dt>
        <dd className="text-gray-800">
          <Compared contrast={field("sources")} separator="; " />
        </dd>
      </dl>
    </label>
  );
};

/**
 * One question: these records look alike — are they one publication?
 *
 * The records are shown side by side because that is the whole of the evidence,
 * and the answer is one of three: they are one (merge into the record chosen to
 * keep), they are not (remembered, so it is never asked again), or not now.
 */
export const DuplicateStep: FC<{
  cluster: DuplicateCluster;
  position: number;
  total: number;
  busy: boolean;
  onMerge: (winner: Publication) => void;
  onDistinguish: () => void;
  onSkip: () => void;
}> = ({ cluster, position, total, busy, onMerge, onDistinguish, onSkip }) => {
  const t = useTranslations("duplicates");
  const common = useTranslations("common");

  // The record entered first is offered as the one to keep: the others came
  // along after it, and something has to be proposed. The reviewer decides.
  const [keptId, setKeptId] = useState(
    Math.min(...cluster.publications.map((p) => p.id!)),
  );
  const kept = cluster.publications.find((p) => p.id === keptId);

  return (
    <div className="flex flex-col gap-6 p-8 w-full min-h-full">
      <div className="flex gap-4 justify-between items-baseline pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-xl">{name(cluster)}</h2>
          <p className="mt-1 text-sm text-gray-600">
            {t("lookAlike", { count: cluster.publications.length })}{" "}
            {t("differences")}
          </p>
        </div>
        <span className="text-sm text-gray-600 shrink-0 tabular-nums">
          {common("progress", { position: position + 1, total })}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cluster.publications.map((publication) => (
          <Candidate
            key={publication.id}
            publication={publication}
            others={cluster.publications.filter(
              (other) => other !== publication,
            )}
            kept={publication.id === keptId}
            onKeep={() => setKeptId(publication.id!)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-3 justify-end mt-auto">
        <Button
          label={t("skip")}
          variant="outline"
          width="fit"
          size="medium"
          onClick={onSkip}
        />
        <Button
          label={t("notDuplicates")}
          variant="outline-primary"
          width="fit"
          size="medium"
          disabled={busy}
          onClick={onDistinguish}
        />
        <Button
          label={t("merge")}
          variant="danger"
          width="fit"
          size="medium"
          loading={busy}
          disabled={!kept}
          onClick={() => kept && onMerge(kept)}
        />
      </div>
    </div>
  );
};

/**
 * A decision already made, opened like any other question — the same evidence
 * side by side, and the way out of it.
 *
 * It sits in the review rather than beside it because it is the same work: a
 * reviewer who misread a cluster finds it where they answered it, not in a
 * separate place they have to know about.
 */
export const RuledApartStep: FC<{
  distinction: Distinction;
  busy: boolean;
  onReconsider: () => void;
}> = ({ distinction, busy, onReconsider }) => {
  const t = useTranslations("duplicates");

  return (
    <div className="flex flex-col gap-6 p-8 w-full min-h-full">
      <div className="flex gap-4 justify-between items-baseline pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-xl">{distinction.publications[0]?.title}</h2>
          <p className="mt-1 text-sm text-gray-600">
            {t("ruledApartBy", { actor: distinction.actor })} {t("differences")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {distinction.publications.map((publication) => (
          <Candidate
            key={publication.id}
            publication={publication}
            others={distinction.publications.filter(
              (other) => other !== publication,
            )}
          />
        ))}
      </div>

      <div className="flex justify-end mt-auto">
        <Button
          label={t("reconsider")}
          variant="outline-primary"
          width="fit"
          size="medium"
          loading={busy}
          onClick={onReconsider}
        />
      </div>
    </div>
  );
};

/**
 * The duplicate review without state: the queue beside the open question, the
 * open decision when `selected` is set, or a message when everything is
 * answered. With no clusters and no decisions it says there is nothing to
 * reconcile. Each question and decision is keyed by its records, so a new
 * question starts with a choice of its own.
 */
export const DuplicateReviewView: FC<{
  clusters: DuplicateCluster[];
  distinctions: Distinction[];
  position: number;
  /** Which ruled-apart pair is open, or `null` while a question is. */
  selected: number | null;
  busy: boolean;
  onSelect: (position: number) => void;
  onSelectRuledApart: (position: number) => void;
  onMerge: (winner: Publication) => void;
  onDistinguish: () => void;
  onReconsider: (distinction: Distinction) => void;
  onSkip: () => void;
}> = ({
  clusters,
  distinctions,
  position,
  selected,
  busy,
  onSelect,
  onSelectRuledApart,
  onMerge,
  onDistinguish,
  onReconsider,
  onSkip,
}) => {
  const t = useTranslations("duplicates");
  const ruledApart = selected === null ? null : distinctions[selected];

  return clusters.length === 0 && distinctions.length === 0 ? (
    <div className="flex flex-col gap-4 items-center py-16 text-center">
      <h1 className="text-2xl font-normal">{t("nothingToReconcile")}</h1>
      <p className="text-gray-600">{t("nothingToReconcileDetail")}</p>
      <Link href="/" className="anchor">
        {t("backToIndex")}
      </Link>
    </div>
  ) : (
    <div className="flex overflow-hidden my-4 rounded-lg border border-gray-200 h-[calc(100dvh-15.5rem)]">
      <DuplicateQueue
        clusters={clusters}
        distinctions={distinctions}
        position={position}
        selected={selected}
        onSelect={onSelect}
        onSelectRuledApart={onSelectRuledApart}
      />
      <div className="overflow-y-auto flex-1">
        {ruledApart ? (
          <RuledApartStep
            key={recordsKey(ruledApart)}
            distinction={ruledApart}
            busy={busy}
            onReconsider={() => onReconsider(ruledApart)}
          />
        ) : clusters.length === 0 ? (
          <div className="flex flex-col gap-3 justify-center items-center p-8 h-full text-center">
            <h2 className="text-xl">{t("allAnswered")}</h2>
            <p className="text-sm text-gray-600">{t("allAnsweredDetail")}</p>
          </div>
        ) : (
          <DuplicateStep
            key={recordsKey(clusters[position])}
            cluster={clusters[position]}
            position={position}
            total={clusters.length}
            busy={busy}
            onMerge={onMerge}
            onDistinguish={onDistinguish}
            onSkip={onSkip}
          />
        )}
      </div>
    </div>
  );
};

/**
 * The duplicate review: the queue of `clusters` beside the question that is
 * open, and the decisions already made, `distinctions`. It answers through
 * `merge`, `distinguish` and `reconsider`, in a publication store of its own.
 */
const DuplicateReview: FC<{
  clusters: DuplicateCluster[];
  distinctions: Distinction[];
}> = ({ clusters, distinctions }) => (
  <PublicationStoreProvider>
    <Review clusters={clusters} distinctions={distinctions} />
  </PublicationStoreProvider>
);

// The body of `DuplicateReview`: it holds the reviewer's place and the clusters
// answered in this sitting, and disables the answers while one runs.
const Review: FC<{
  clusters: DuplicateCluster[];
  distinctions: Distinction[];
}> = ({ clusters, distinctions }) => {
  const store = usePublicationStore();
  const { pending: busy, run } = useMutation();

  const [position, setPosition] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  // An answered cluster is gone when the page is read again; until then the
  // reviewer keeps its place, so answering does not throw them back to the top.
  const [answered, setAnswered] = useState<string[]>([]);
  const remaining = clusters.filter((c) => !answered.includes(recordsKey(c)));
  const current = remaining[Math.min(position, remaining.length - 1)];

  // Runs `decide`, which answers `cluster`. When it succeeds, the cluster is
  // marked answered, and `run` reads the page again.
  function answer(cluster: DuplicateCluster, decide: () => Promise<boolean>) {
    run(async () => {
      const decided = await decide();
      if (decided)
        setAnswered((previous) => [...previous, recordsKey(cluster)]);
      return decided;
    });
  }

  function handleMerge(winner: Publication) {
    if (current)
      answer(current, () =>
        merge(store, {
          winner,
          losers: current.publications.filter((p) => p.id !== winner.id),
        }),
      );
  }

  function handleDistinguish() {
    if (current)
      answer(current, () =>
        distinguish(current.publications.map((p) => p.id!)),
      );
  }

  // Takes back the ruling `distinction`. When that succeeds, the review opens
  // the first question and forgets the clusters answered in this sitting, and
  // `run` reads the queue again. The pair may rejoin a cluster larger than
  // itself, so the queue is read rather than patched. A cluster left on the
  // answered list would be filtered out of the queue the server sends back.
  function handleReconsider(distinction: Distinction) {
    run(async () => {
      const back = await reconsider(distinction.publications.map((p) => p.id!));

      if (back) {
        setAnswered([]);
        setPosition(0);
        setSelected(null);
      }
      return back;
    });
  }

  function handleSkip() {
    setPosition((p) => Math.min(p + 1, remaining.length - 1));
  }

  return (
    <DuplicateReviewView
      clusters={remaining}
      distinctions={distinctions}
      position={Math.min(position, Math.max(remaining.length - 1, 0))}
      selected={selected}
      busy={busy}
      onSelect={(next) => {
        // Opening a question closes whatever decision was being looked at.
        setSelected(null);
        setPosition(next);
      }}
      onSelectRuledApart={setSelected}
      onMerge={handleMerge}
      onDistinguish={handleDistinguish}
      onReconsider={handleReconsider}
      onSkip={handleSkip}
    />
  );
};

export default DuplicateReview;
