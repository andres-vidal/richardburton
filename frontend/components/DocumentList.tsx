"use client";

import { Key } from "app";
import Button from "components/Button";
import TextInput from "components/TextInput";
import { Link, useRouter } from "i18n/navigation";
import {
  DOCUMENTS_PER_PAGE,
  archive as archiveDocument,
  create,
  list,
  rename as renameDocument,
  unarchive,
  type DocumentPage,
  type DocumentSummary,
} from "modules/publication/document-remote";
import { useFormatDate } from "modules/dates";
import { useTranslations } from "next-intl";
import { FC, FormEvent, useState } from "react";

/** Which side of the list is being read. */
type Side = "current" | "archived";

/**
 * One document in the list: what it holds, when it last changed, and what can
 * be done with it.
 *
 * The name is editable in place rather than behind a dialog, since renaming is
 * a correction — a batch called "Second pass" that turns out to be the 1970s —
 * and a dialog asks more of the reader than the change is worth.
 */
const Entry: FC<{
  document: DocumentSummary;
  onRename: (name: string) => Promise<void>;
  /** Archive it, or put it back if it is archived already. */
  onMove: () => Promise<void>;
}> = ({ document, onRename, onMove }) => {
  const t = useTranslations("documents");
  const formatDate = useFormatDate();

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(document.name);
  const [working, setWorking] = useState(false);

  async function commit() {
    const wanted = name.trim();

    setRenaming(false);

    if (wanted === "" || wanted === document.name) {
      setName(document.name);
      return;
    }

    await act(() => onRename(wanted));
  }

  async function act(what: () => Promise<void>) {
    setWorking(true);
    try {
      await what();
    } finally {
      setWorking(false);
    }
  }

  return (
    <li
      data-archived={Boolean(document.archivedAt)}
      className="flex gap-3 items-center py-2 px-4 rounded-lg border border-gray-200 transition-colors data-[archived=true]:bg-gray-50"
    >
      {renaming ? (
        <span className="min-w-0 grow">
          <TextInput
            bordered
            value={name}
            onChange={setName}
            aria-label={t("renameLabel", { name: document.name })}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === Key.ENTER) commit();
              if (event.key === Key.ESCAPE) {
                setName(document.name);
                setRenaming(false);
              }
            }}
          />
        </span>
      ) : (
        <Link
          href={`/admin/publications/documents/${document.id}`}
          className="flex gap-4 justify-between items-baseline py-1 min-w-0 rounded grow focus-ring"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium truncate">
              {document.name}
            </span>
            <span className="block text-xs text-gray-600">
              {t("rows", { count: document.rows })}
            </span>
          </span>
          <span className="text-xs text-gray-600 shrink-0 tabular-nums">
            {formatDate(document.updatedAt)}
          </span>
        </Link>
      )}

      {document.archivedAt ? (
        <Button
          label={t("restore")}
          variant="outline"
          width="fit"
          size="small"
          loading={working}
          onClick={() => act(onMove)}
        />
      ) : (
        <span className="flex gap-2 shrink-0">
          <Button
            label={t("rename")}
            variant="outline"
            width="fit"
            size="small"
            disabled={working || renaming}
            onClick={() => setRenaming(true)}
          />
          <Button
            label={t("archive")}
            variant="outline"
            width="fit"
            size="small"
            loading={working}
            onClick={() => act(onMove)}
          />
        </span>
      )}
    </li>
  );
};

/**
 * Every import document on one side of the list, and the way to start another.
 *
 * A document is one batch of import work under a name, kept between sittings.
 * The list is shared: there is no owner and no membership, so everyone sees all
 * of them and may open any. That is why a name is asked for — it is what tells
 * one batch from another once several people are keeping them.
 *
 * A document is archived rather than deleted. What it holds is a record of what
 * was prepared, and a batch taken off the list by mistake is one somebody spent
 * an afternoon on, so the archived side of the list is readable and anything on
 * it can be put back.
 *
 * Each side of the list is a page of its own, and switching sides navigates to
 * it. Further pages are read from the last document held rather than by
 * counting, so a document changed in between is not read twice.
 */
const DocumentList: FC<{
  /** Which side of the list is shown. */
  side: Side;
  /** The first page of that side, read with the page. */
  first: DocumentPage;
  /** How a further page is read. Defaults to asking the server. */
  readMore?: typeof list;
  /** How one is started. Defaults to asking the server. */
  start?: (name: string) => Promise<DocumentSummary>;
  /** How one is renamed, archived and put back. Default to asking the server. */
  rename?: (id: number, name: string) => Promise<DocumentSummary>;
  archive?: (id: number) => Promise<DocumentSummary>;
  restore?: (id: number) => Promise<DocumentSummary>;
}> = ({
  side,
  first,
  readMore = list,
  start = create,
  rename = renameDocument,
  archive = archiveDocument,
  restore = unarchive,
}) => {
  const t = useTranslations("documents");
  const router = useRouter();

  const [page, setPage] = useState(first);
  const [reading, setReading] = useState(false);
  const [name, setName] = useState("");
  const [starting, setStarting] = useState(false);

  async function showMore() {
    const last = page.entries.at(-1);
    if (reading || !last) return;

    setReading(true);

    try {
      const found = await readMore({
        limit: DOCUMENTS_PER_PAGE,
        archived: side === "archived",
        after: last,
      });

      setPage((held) => ({
        entries: [...held.entries, ...found.entries],
        more: found.more,
      }));
    } finally {
      setReading(false);
    }
  }

  // A document that has been renamed is the same document under a new name, and
  // one that has been archived or put back belongs to the other side of the
  // list. Both answers came back with the request, so neither is worth reading
  // the list again for.
  const replace = (renamed: DocumentSummary) =>
    setPage((held) => ({
      ...held,
      entries: held.entries.map((document) =>
        document.id === renamed.id ? renamed : document,
      ),
    }));

  const remove = (id: number) =>
    setPage((held) => ({
      ...held,
      entries: held.entries.filter((document) => document.id !== id),
    }));

  async function handleStart(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setStarting(true);
    try {
      const started = await start(name.trim());
      router.push(`/admin/publications/documents/${started.id}`);
    } finally {
      setStarting(false);
    }
  }

  // Looking at the side already shown changes nothing, so it goes nowhere.
  function look(which: Side) {
    if (which === side) return;

    router.push(
      which === "archived"
        ? "/admin/publications/documents?archived=true"
        : "/admin/publications/documents",
    );
  }

  const documents = page.entries;

  return (
    <div className="space-y-6 max-w-2xl">
      <form
        onSubmit={handleStart}
        className="flex flex-wrap gap-3 items-end p-4 bg-white rounded-lg border border-gray-200"
      >
        <label className="flex flex-col gap-1 text-sm min-w-64 grow">
          <span className="text-gray-500">{t("nameLabel")}</span>
          <TextInput
            bordered
            required
            value={name}
            onChange={setName}
            placeholder={t("namePlaceholder")}
            aria-label={t("nameLabel")}
          />
        </label>
        <Button
          label={t("start")}
          type="submit"
          width="fit"
          size="field"
          loading={starting}
          disabled={!name.trim() || starting}
        />
      </form>

      <div role="group" aria-label={t("which")} className="flex gap-2">
        <Button
          label={t("onTheList")}
          variant={side === "current" ? "outline-primary" : "outline"}
          width="fit"
          size="small"
          aria-pressed={side === "current"}
          onClick={() => look("current")}
        />
        <Button
          label={t("archivedList")}
          variant={side === "archived" ? "outline-primary" : "outline"}
          width="fit"
          size="small"
          aria-pressed={side === "archived"}
          onClick={() => look("archived")}
        />
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-gray-600">
          {side === "archived" ? t("noneArchived") : t("none")}
        </p>
      ) : (
        <>
          <ul
            aria-label={side === "archived" ? t("archivedList") : t("title")}
            className="space-y-2"
          >
            {documents.map((document) => (
              <Entry
                key={document.id}
                document={document}
                onRename={async (next) =>
                  replace(await rename(document.id, next))
                }
                onMove={async () => {
                  await (document.archivedAt ? restore : archive)(document.id);
                  remove(document.id);
                }}
              />
            ))}
          </ul>

          {page.more ? (
            <Button
              label={t("more")}
              variant="outline"
              width="fit"
              size="small"
              loading={reading}
              onClick={showMore}
            />
          ) : null}
        </>
      )}
    </div>
  );
};

export default DocumentList;
