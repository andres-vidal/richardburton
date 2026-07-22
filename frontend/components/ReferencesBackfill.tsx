"use client";

import Button from "components/Button";
import ReferencesEditor from "components/ReferencesEditor";
import {
  usePublication,
  usePublicationReferences,
  useUnreferencedPublicationCount,
} from "modules/publication/hooks";
import type { PublicationId } from "modules/publication/model";
import { index, update } from "modules/publication/remote";
import {
  discardEdit,
  overrideReferences,
  resetAll,
} from "modules/publication/store";
import Link from "next/link";
import { FC, KeyboardEvent, useEffect, useRef, useState } from "react";

const optionId = (id: PublicationId) => `references-queue-option-${id}`;

/** One option in the queue listbox: title + a dot marking whether it's sourced. */
const QueueOption: FC<{
  id: PublicationId;
  active: boolean;
  onSelect: () => void;
}> = ({ id, active, onSelect }) => {
  const publication = usePublication(id);
  const sourced = usePublicationReferences(id).length > 0;
  const ref = useRef<HTMLLIElement>(null);

  // Keep the selected option in view as arrow keys move through a long queue.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <li
      ref={ref}
      id={optionId(id)}
      role="option"
      aria-selected={active}
      aria-label={
        sourced ? `${publication?.title} — sourced` : publication?.title
      }
      onClick={onSelect}
      data-active={active}
      className="flex gap-2 items-center px-3 py-2 text-sm rounded cursor-pointer transition-colors hover:bg-gray-100 data-[active=true]:bg-indigo-100 data-[active=true]:text-indigo-900"
    >
      <span
        aria-hidden
        className={`w-2 h-2 rounded-full shrink-0 ${sourced ? "bg-green-500" : "bg-gray-300"}`}
      />
      <span className="truncate">{publication?.title}</span>
    </li>
  );
};

/**
 * The queue of reference-less publications as a single-select listbox: one tab
 * stop, arrow / Home / End move the selection (via `aria-activedescendant`),
 * click jumps directly.
 */
export const ReferencesQueue: FC<{
  ids: PublicationId[];
  activeId: PublicationId | undefined;
  onSelect: (position: number) => void;
}> = ({ ids, activeId, onSelect }) => {
  const position = activeId === undefined ? -1 : ids.indexOf(activeId);
  // Live count of entries still missing references — shrinks as sources are added.
  const missingCount = useUnreferencedPublicationCount();

  const move = (event: KeyboardEvent, next: number) => {
    event.preventDefault();
    onSelect(Math.max(0, Math.min(next, ids.length - 1)));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const key = event.key;
    if (key === "ArrowDown") move(event, position + 1);
    else if (key === "ArrowUp") move(event, position - 1);
    else if (key === "Home") move(event, 0);
    else if (key === "End") move(event, ids.length - 1);
  };

  return (
    <div className="flex flex-col w-72 border-r border-gray-200 shrink-0">
      <header className="flex gap-2 justify-between items-baseline px-3 py-2 border-b border-gray-200">
        <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
          Missing references
        </span>
        <span className="px-1.5 py-0.5 text-xs font-medium text-indigo-700 rounded-full bg-indigo-100 tabular-nums">
          {missingCount}
        </span>
      </header>
      <ul
        role="listbox"
        aria-label="Publications missing references"
        tabIndex={0}
        aria-activedescendant={
          activeId === undefined ? undefined : optionId(activeId)
        }
        onKeyDown={onKeyDown}
        className="overflow-y-auto flex-1 p-2 space-y-0.5 min-h-0 scrollbar scrollbar-thin scrollbar-thumb-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
      >
        {ids.map((id, i) => (
          <QueueOption
            key={id}
            id={id}
            active={id === activeId}
            onSelect={() => onSelect(i)}
          />
        ))}
      </ul>
    </div>
  );
};

/** The detail pane: the selected publication's context + the references editor. */
export const BackfillStep: FC<{
  id: PublicationId;
  position: number;
  total: number;
  saving: boolean;
  onSave: () => void;
  onSkip: () => void;
}> = ({ id, position, total, saving, onSave, onSkip }) => {
  const publication = usePublication(id);
  const references = usePublicationReferences(id);

  return (
    <div className="flex flex-col gap-6 p-8 w-full min-h-full">
      {publication && (
        <div className="pb-4 border-b border-gray-200">
          <div className="flex gap-4 justify-between items-baseline">
            <div className="text-xl">
              {publication.title}{" "}
              <span className="text-indigo-500">({publication.authors})</span>
            </div>
            <span className="text-sm text-gray-600 shrink-0 tabular-nums">
              {position + 1} / {total}
            </span>
          </div>
          <div className="mt-1 text-sm text-gray-600">
            {publication.originalTitle} — {publication.originalAuthors} ·{" "}
            {publication.year} · {publication.countries} ·{" "}
            {publication.publishers}
          </div>
        </div>
      )}

      <ReferencesEditor
        value={references}
        onChange={(next) => overrideReferences(id, next)}
      />

      <div className="flex gap-3 justify-end mt-auto">
        <Button
          label="Skip"
          variant="outline"
          width="fit"
          size="medium"
          onClick={onSkip}
        />
        <Button
          label="Save & next"
          width="fit"
          size="medium"
          loading={saving}
          // Nothing to save if no source was added — Skip moves past instead.
          disabled={references.length === 0 || saving}
          onClick={onSave}
        />
      </div>
    </div>
  );
};

/**
 * Presentational shell — takes the queue as a prop so its loading, empty, and
 * populated states can each be rendered (and a11y-checked) in isolation.
 */
export const ReferencesBackfillView: FC<{
  ids: PublicationId[] | undefined;
  position: number;
  saving: boolean;
  onSelect: (position: number) => void;
  onSave: () => void;
  onSkip: () => void;
}> = ({ ids, position, saving, onSelect, onSave, onSkip }) => {
  const currentId = ids?.[position];
  const empty = ids !== undefined && ids.length === 0;

  return ids === undefined ? (
    <p className="py-8 text-center text-gray-600">
      Finding publications without references…
    </p>
  ) : empty ? (
    <div className="flex flex-col gap-4 items-center py-16 text-center">
      <h1 className="text-2xl font-normal">All caught up</h1>
      <p className="text-gray-600">Every publication already has references.</p>
      <Link href="/" className="anchor">
        Back to the index
      </Link>
    </div>
  ) : (
    // Fill the area below the sticky header and scroll inside the panes — so the
    // page itself doesn't scroll here, avoiding a second scrollbar.
    <div className="flex overflow-hidden my-4 rounded-lg border border-gray-200 h-[calc(100dvh-15.5rem)]">
      <ReferencesQueue ids={ids} activeId={currentId} onSelect={onSelect} />
      {currentId !== undefined && (
        <div className="overflow-y-auto flex-1">
          <BackfillStep
            // Key by id so each publication gets a fresh editor mount.
            key={currentId}
            id={currentId}
            position={position}
            total={ids.length}
            saving={saving}
            onSave={onSave}
            onSkip={onSkip}
          />
        </div>
      )}
    </div>
  );
};

const ReferencesBackfill: FC = () => {
  const [ids, setIds] = useState<PublicationId[]>();
  const [position, setPosition] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    index({ unreferenced: true }).then(setIds);
    // Leave the store as we found it when the admin walks away.
    return () => resetAll();
  }, []);

  const currentId = ids?.[position];

  async function handleSave() {
    if (currentId === undefined) return;
    setSaving(true);
    const saved = await update(currentId);
    setSaving(false);
    if (saved) setPosition((p) => Math.min(p + 1, (ids?.length ?? 1) - 1));
  }

  function handleSkip() {
    if (currentId !== undefined) discardEdit(currentId);
    setPosition((p) => Math.min(p + 1, (ids?.length ?? 1) - 1));
  }

  return (
    <ReferencesBackfillView
      ids={ids}
      position={position}
      saving={saving}
      onSelect={setPosition}
      onSave={handleSave}
      onSkip={handleSkip}
    />
  );
};

export default ReferencesBackfill;
