"use client";

import type { Distinction, DuplicateCluster } from "app/publications/read";
import Button from "components/Button";
import { Publication } from "modules/publication/model";
import { distinguish, merge, reconsider } from "modules/publication/remote";
import {
  PublicationStoreProvider,
  usePublicationStore,
} from "modules/publication/workspace";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FC, KeyboardEvent, useEffect, useRef, useState } from "react";

const optionId = (position: number) => `duplicate-cluster-option-${position}`;

/** What a cluster is called in the queue: the title its records nearly share. */
const name = (cluster: DuplicateCluster) =>
  cluster.publications[0]?.title ?? "";

/**
 * The queue of clusters as a single-select listbox — one tab stop, arrows move
 * the selection, click jumps. The same shape the references backfill uses, so
 * an admin who has stepped through one knows this one.
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
  const move = (event: KeyboardEvent, next: number) => {
    event.preventDefault();
    onSelect(Math.max(0, Math.min(next, clusters.length - 1)));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const key = event.key;
    if (key === "ArrowDown") move(event, position + 1);
    else if (key === "ArrowUp") move(event, position - 1);
    else if (key === "Home") move(event, 0);
    else if (key === "End") move(event, clusters.length - 1);
  };

  return (
    <div className="flex flex-col w-72 border-r border-gray-200 shrink-0">
      <header className="flex gap-2 justify-between items-baseline px-3 py-2 border-b border-gray-200">
        <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
          Possible duplicates
        </span>
        <span className="px-1.5 py-0.5 text-xs font-medium text-indigo-700 rounded-full bg-indigo-100 tabular-nums">
          {clusters.length}
        </span>
      </header>
      <ul
        role="listbox"
        aria-label="Clusters of possible duplicates"
        tabIndex={0}
        aria-activedescendant={optionId(position)}
        onKeyDown={onKeyDown}
        className="overflow-y-auto flex-1 p-2 space-y-0.5 min-h-0 scrollbar scrollbar-thin scrollbar-thumb-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
      >
        {clusters.map((cluster, index) => (
          <QueueOption
            key={cluster.publications.map((p) => p.id).join("-")}
            id={optionId(index)}
            cluster={cluster}
            active={selected === null && index === position}
            onSelect={() => onSelect(index)}
          />
        ))}
      </ul>
      {distinctions.length > 0 && (
        <div className="flex flex-col border-t border-gray-200 max-h-64 shrink-0">
          <div className="flex gap-2 justify-between items-baseline px-3 py-2">
            <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
              Ruled apart
            </span>
            <span className="px-1.5 py-0.5 text-xs font-medium text-gray-700 rounded-full bg-gray-100 tabular-nums">
              {distinctions.length}
            </span>
          </div>
          <ul
            aria-label="Records ruled apart"
            className="overflow-y-auto p-2 space-y-0.5 min-h-0 scrollbar scrollbar-thin scrollbar-thumb-indigo-600"
          >
            {distinctions.map((distinction, index) => (
              <li key={distinction.publications.map((p) => p.id).join("-")}>
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
    </div>
  );
};

const QueueOption: FC<{
  id: string;
  cluster: DuplicateCluster;
  active: boolean;
  onSelect: () => void;
}> = ({ id, cluster, active, onSelect }) => {
  const ref = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <li
      ref={ref}
      id={id}
      role="option"
      aria-selected={active}
      onClick={onSelect}
      data-active={active}
      className="flex gap-2 justify-between items-center px-3 py-2 text-sm rounded cursor-pointer transition-colors hover:bg-gray-100 data-[active=true]:bg-indigo-100 data-[active=true]:text-indigo-900"
    >
      <span className="truncate">{name(cluster)}</span>
      <span className="text-xs text-gray-600 shrink-0 tabular-nums">
        {cluster.publications.length}
      </span>
    </li>
  );
};

/** One record of the cluster, with the choice to keep it. */
/**
 * One record's evidence. `onKeep` is what makes it a choice — without it the
 * card is the same evidence with nothing to decide, which is what a decision
 * already made looks like.
 */
const Candidate: FC<{
  publication: Publication;
  kept?: boolean;
  onKeep?: () => void;
}> = ({ publication: p, kept = false, onKeep }) => (
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
          aria-label={`Keep ${p.title}`}
        />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {p.title}{" "}
          <span className="font-normal text-gray-600">({p.year})</span>
        </p>
        <p className="text-xs text-gray-600">{p.authors}</p>
      </div>
    </div>
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      <dt className="text-gray-600">Original</dt>
      <dd className="text-gray-800">
        {p.originalTitle} — {p.originalAuthors}
      </dd>
      <dt className="text-gray-600">Countries</dt>
      <dd className="text-gray-800">
        {Publication.describeValue(p.countries, "countries")}
      </dd>
      <dt className="text-gray-600">Publishers</dt>
      <dd className="text-gray-800">{p.publishers}</dd>
      <dt className="text-gray-600">Sources</dt>
      <dd className="text-gray-800">
        {p.references.length === 0 ? "None" : p.references.join("; ")}
      </dd>
    </dl>
  </label>
);

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
            {cluster.publications.length} records look alike. Keep one and merge
            the rest into it, or say they are different publications.
          </p>
        </div>
        <span className="text-sm text-gray-600 shrink-0 tabular-nums">
          {position + 1} / {total}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cluster.publications.map((publication) => (
          <Candidate
            key={publication.id}
            publication={publication}
            kept={publication.id === keptId}
            onKeep={() => setKeptId(publication.id!)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-3 justify-end mt-auto">
        <Button
          label="Skip"
          variant="outline"
          width="fit"
          size="medium"
          onClick={onSkip}
        />
        <Button
          label="Not duplicates"
          variant="outline-primary"
          width="fit"
          size="medium"
          disabled={busy}
          onClick={onDistinguish}
        />
        <Button
          label="Merge into the selected one"
          variant="danger"
          width="fit"
          size="medium"
          loading={busy}
          disabled={!kept || busy}
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
}> = ({ distinction, busy, onReconsider }) => (
  <div className="flex flex-col gap-6 p-8 w-full min-h-full">
    <div className="flex gap-4 justify-between items-baseline pb-4 border-b border-gray-200">
      <div>
        <h2 className="text-xl">{distinction.publications[0]?.title}</h2>
        <p className="mt-1 text-sm text-gray-600">
          Ruled apart by {distinction.actor}. These are not offered as possible
          duplicates while that stands.
        </p>
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      {distinction.publications.map((publication) => (
        <Candidate key={publication.id} publication={publication} />
      ))}
    </div>

    <div className="flex justify-end mt-auto">
      <Button
        label="Reconsider"
        variant="outline-primary"
        width="fit"
        size="medium"
        loading={busy}
        disabled={busy}
        onClick={onReconsider}
      />
    </div>
  </div>
);

/** Presentational shell, so the empty and populated states render in isolation. */
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
  const ruledApart = selected === null ? null : distinctions[selected];

  return clusters.length === 0 && distinctions.length === 0 ? (
    <div className="flex flex-col gap-4 items-center py-16 text-center">
      <h1 className="text-2xl font-normal">Nothing to reconcile</h1>
      <p className="text-gray-600">
        No two records look like the same publication.
      </p>
      <Link href="/" className="anchor">
        Back to the index
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
            key={ruledApart.publications.map((p) => p.id).join("-")}
            distinction={ruledApart}
            busy={busy}
            onReconsider={() => onReconsider(ruledApart)}
          />
        ) : clusters.length === 0 ? (
          <div className="flex flex-col gap-3 justify-center items-center p-8 h-full text-center">
            <h2 className="text-xl">Every question answered</h2>
            <p className="text-sm text-gray-600">
              No two records are left looking alike. What was ruled apart is on
              the left, and can be put back among the questions.
            </p>
          </div>
        ) : (
          <DuplicateStep
            // Key by the cluster's members so each question gets a fresh choice.
            key={clusters[position].publications.map((p) => p.id).join("-")}
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

const DuplicateReview: FC<{
  clusters: DuplicateCluster[];
  distinctions: Distinction[];
}> = ({ clusters, distinctions }) => (
  <PublicationStoreProvider>
    <Review clusters={clusters} distinctions={distinctions} />
  </PublicationStoreProvider>
);

const Review: FC<{
  clusters: DuplicateCluster[];
  distinctions: Distinction[];
}> = ({ clusters, distinctions }) => {
  const store = usePublicationStore();
  const router = useRouter();

  const [position, setPosition] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // An answered cluster is gone when the page is read again; until then the
  // reviewer keeps its place, so answering does not throw them back to the top.
  const [answered, setAnswered] = useState<string[]>([]);
  const key = (cluster: DuplicateCluster) =>
    cluster.publications.map((p) => p.id).join("-");

  const remaining = clusters.filter((c) => !answered.includes(key(c)));
  const current = remaining[Math.min(position, remaining.length - 1)];

  function advance(cluster: DuplicateCluster) {
    setAnswered((previous) => [...previous, key(cluster)]);
    router.refresh();
  }

  async function handleMerge(winner: Publication) {
    if (!current) return;
    setBusy(true);
    const merged = await merge(store, {
      winner,
      losers: current.publications.filter((p) => p.id !== winner.id),
    });
    setBusy(false);
    if (merged) advance(current);
  }

  async function handleDistinguish() {
    if (!current) return;
    setBusy(true);
    const kept = await distinguish(current.publications.map((p) => p.id!));
    setBusy(false);
    if (kept) advance(current);
  }

  async function handleReconsider(distinction: Distinction) {
    setBusy(true);
    const back = await reconsider(distinction.publications.map((p) => p.id!));
    setBusy(false);
    // The pair rejoins the questions, so the queue is read again rather than
    // patched — the cluster it belongs to may be larger than the pair. What
    // this sitting has already answered is forgotten with it: the reviewer is
    // revisiting decisions, and a cluster still on that list would come back
    // from the server only to be filtered straight out again.
    if (back) {
      setAnswered([]);
      setPosition(0);
      setSelected(null);
      router.refresh();
    }
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
