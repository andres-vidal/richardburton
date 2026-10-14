"use client";

import Button from "components/Button";
import SourcesEditor from "components/SourcesEditor";
import {
  usePublication,
  usePublicationMarking,
  usePublicationSources,
  useStoredPublicationSources,
  useUnsourcedPublicationCount,
} from "modules/publication/hooks";
import { type PublicationId } from "modules/publication/model";
import type { PublicationIndex } from "modules/publication/store";
import {
  PublicationStoreProvider,
  usePublicationStore,
} from "modules/publication/workspace";
import { update } from "modules/publication/remote";
import { discardEdit, setSources } from "modules/publication/store";
import { Link } from "i18n/navigation";
import { useTranslations } from "next-intl";
import { FC, useState } from "react";
import QueueListbox from "./QueueListbox";

/**
 * What a publication's option in the queue shows: a dot that is green when the
 * publication has saved sources, and its title. A sourced publication's option
 * is named by its title followed by `backfill.sourced`.
 *
 * Only saved sources count, so a source that is still a draft does not turn
 * the dot green.
 */
const SourcedTitle: FC<{ id: PublicationId }> = ({ id }) => {
  const t = useTranslations("backfill");
  const publication = usePublication(id);
  const sourced = useStoredPublicationSources(id).length > 0;

  return (
    <>
      <span
        aria-hidden
        data-sourced={sourced}
        className="w-2 h-2 bg-gray-300 rounded-full shrink-0 data-[sourced=true]:bg-green-500"
      />
      <span className="truncate">{publication?.title}</span>
      {sourced && <span className="sr-only">{t("sourced")}</span>}
    </>
  );
};

/**
 * The queue of publications that have no sources, as a `QueueListbox`. The
 * count beside the heading is the number of publications still without saved
 * sources, so it drops as sources are saved.
 */
export const SourcesQueue: FC<{
  ids: PublicationId[];
  activeId: PublicationId | undefined;
  onSelect: (position: number) => void;
}> = ({ ids, activeId, onSelect }) => {
  const t = useTranslations("backfill");
  const missingCount = useUnsourcedPublicationCount();

  return (
    <QueueListbox
      heading={t("missingSources")}
      count={missingCount}
      label={t("queue")}
      items={ids}
      itemKey={(id) => id}
      renderOption={(id) => <SourcedTitle id={id} />}
      position={activeId === undefined ? -1 : ids.indexOf(activeId)}
      onSelect={onSelect}
    />
  );
};

/**
 * The pane for the publication `id`: its title, translators and the rest of
 * its record, its place in the queue, and the sources editor. The save button
 * reads Save on the last publication, which has no next one, and Save & next
 * otherwise. It is disabled while the publication has no sources or a save
 * runs, since Skip is the way past a publication without sources.
 */
export const BackfillStep: FC<{
  id: PublicationId;
  position: number;
  total: number;
  saving: boolean;
  onSave: () => void;
  onSkip: () => void;
}> = ({ id, position, total, saving, onSave, onSkip }) => {
  const t = useTranslations("backfill");
  const common = useTranslations("common");
  const marked = usePublicationMarking();
  const store = usePublicationStore();
  const publication = usePublication(id);
  const sources = usePublicationSources(id);

  return (
    <div className="flex flex-col gap-6 p-8 w-full min-h-full">
      {publication && (
        <div className="pb-4 border-b border-gray-200">
          <div className="flex gap-4 justify-between items-baseline">
            <div className="text-xl">
              {publication.title}{" "}
              <span className="text-indigo-500">
                ({marked.value(publication, "authors")})
              </span>
            </div>
            <span className="text-sm text-gray-600 shrink-0 tabular-nums">
              {common("progress", { position: position + 1, total })}
            </span>
          </div>
          <div className="mt-1 text-sm text-gray-600">
            {t("line", {
              originalTitle: publication.originalTitle,
              originalAuthors: marked.value(publication, "originalAuthors"),
              year: publication.year,
              countries: marked.value(publication, "countries"),
              publishers: marked.value(publication, "publishers"),
            })}
          </div>
        </div>
      )}

      <SourcesEditor
        value={sources}
        onChange={(next) => setSources(store, id, next)}
      />

      <div className="flex gap-3 justify-end mt-auto">
        <Button
          label={t("skip")}
          variant="outline"
          width="fit"
          size="medium"
          onClick={onSkip}
        />
        <Button
          label={position === total - 1 ? t("save") : t("saveAndNext")}
          width="fit"
          size="medium"
          loading={saving}
          disabled={sources.length === 0}
          onClick={onSave}
        />
      </div>
    </div>
  );
};

/**
 * Renders the queue `ids` beside the editor for the publication at `position`,
 * or an "All caught up" message when `ids` is empty. It holds no state. The
 * editor is keyed by the publication, so each publication gets an editor of
 * its own.
 *
 * The populated view fills the area below the sticky header and scrolls inside
 * its panes, so the page itself does not get a second scrollbar.
 */
export const SourcesBackfillView: FC<{
  ids: PublicationId[];
  position: number;
  saving: boolean;
  onSelect: (position: number) => void;
  onSave: () => void;
  onSkip: () => void;
}> = ({ ids, position, saving, onSelect, onSave, onSkip }) => {
  const t = useTranslations("backfill");
  const currentId = ids[position];

  return ids.length === 0 ? (
    <div className="flex flex-col gap-4 items-center py-16 text-center">
      <h1 className="text-2xl font-normal">{t("allCaughtUp")}</h1>
      <p className="text-gray-600">{t("allCaughtUpDetail")}</p>
      <Link href="/" className="anchor">
        {t("backToIndex")}
      </Link>
    </div>
  ) : (
    <div className="flex overflow-hidden my-4 rounded-lg border border-gray-200 h-[calc(100dvh-15.5rem)]">
      <SourcesQueue ids={ids} activeId={currentId} onSelect={onSelect} />
      {currentId !== undefined && (
        <div className="overflow-y-auto flex-1">
          <BackfillStep
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

/**
 * The wizard that adds sources to the publications in `queue`, read where the
 * page is rendered. It keeps the publications in a store of its own, and opens
 * on the first of them.
 */
const SourcesBackfill: FC<{ queue: PublicationIndex }> = ({ queue }) => (
  <PublicationStoreProvider index={queue}>
    <Backfill queue={queue} />
  </PublicationStoreProvider>
);

// The body of `SourcesBackfill`. It holds the position in the queue. Save
// sends the publication's sources with `update` and moves to the next one when
// the save succeeds. Skip puts the publication back as it was saved and moves
// on. At the end of the queue, both stay on the last publication.
const Backfill: FC<{ queue: PublicationIndex }> = ({ queue }) => {
  const store = usePublicationStore();
  const [position, setPosition] = useState(0);
  const [saving, setSaving] = useState(false);

  const ids = queue.entries.map(({ id }) => id!);
  const currentId = ids[position];

  async function handleSave() {
    if (currentId === undefined) return;
    setSaving(true);
    const saved = await update(store, currentId);
    setSaving(false);
    if (saved) setPosition((p) => Math.min(p + 1, ids.length - 1));
  }

  function handleSkip() {
    if (currentId !== undefined) discardEdit(store, currentId);
    setPosition((p) => Math.min(p + 1, ids.length - 1));
  }

  return (
    <SourcesBackfillView
      ids={ids}
      position={position}
      saving={saving}
      onSelect={setPosition}
      onSave={handleSave}
      onSkip={handleSkip}
    />
  );
};

export default SourcesBackfill;
