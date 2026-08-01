"use client";

import type { DuplicateCluster } from "app/publications/read";
import Button from "components/Button";
import { Publication } from "modules/publication/model";
import { distinguish, merge } from "modules/publication/remote";
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
  position: number;
  onSelect: (position: number) => void;
}> = ({ clusters, position, onSelect }) => {
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
            active={index === position}
            onSelect={() => onSelect(index)}
          />
        ))}
      </ul>
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
const Candidate: FC<{
  publication: Publication;
  kept: boolean;
  onKeep: () => void;
}> = ({ publication: p, kept, onKeep }) => (
  <label
    data-kept={kept}
    className="flex flex-col gap-2 p-4 rounded-lg border cursor-pointer transition-colors data-[kept=true]:border-indigo-400 data-[kept=true]:bg-indigo-50 data-[kept=false]:border-gray-200 data-[kept=false]:hover:bg-gray-50"
  >
    <div className="flex gap-3 items-start">
      <input
        type="radio"
        name="survivor"
        checked={kept}
        onChange={onKeep}
        className="mt-1 accent-indigo-600"
        aria-label={`Keep ${p.title}`}
      />
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
          label="Merge into the one kept"
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

/** Presentational shell, so the empty and populated states render in isolation. */
export const DuplicateReviewView: FC<{
  clusters: DuplicateCluster[];
  position: number;
  busy: boolean;
  onSelect: (position: number) => void;
  onMerge: (winner: Publication) => void;
  onDistinguish: () => void;
  onSkip: () => void;
}> = ({
  clusters,
  position,
  busy,
  onSelect,
  onMerge,
  onDistinguish,
  onSkip,
}) =>
  clusters.length === 0 ? (
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
        position={position}
        onSelect={onSelect}
      />
      <div className="overflow-y-auto flex-1">
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
      </div>
    </div>
  );

const DuplicateReview: FC<{ clusters: DuplicateCluster[] }> = ({
  clusters,
}) => (
  <PublicationStoreProvider>
    <Review clusters={clusters} />
  </PublicationStoreProvider>
);

const Review: FC<{ clusters: DuplicateCluster[] }> = ({ clusters }) => {
  const store = usePublicationStore();
  const router = useRouter();

  const [position, setPosition] = useState(0);
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

  function handleSkip() {
    setPosition((p) => Math.min(p + 1, remaining.length - 1));
  }

  return (
    <DuplicateReviewView
      clusters={remaining}
      position={Math.min(position, Math.max(remaining.length - 1, 0))}
      busy={busy}
      onSelect={setPosition}
      onMerge={handleMerge}
      onDistinguish={handleDistinguish}
      onSkip={handleSkip}
    />
  );
};

export default DuplicateReview;
