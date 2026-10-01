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

/** Which side of the list is shown: current documents or archived ones. */
type Side = "current" | "archived";

/**
 * One document in the list. It links to the document and shows its name, row
 * count and last change date, with buttons to rename and archive it. An
 * archived document has a button to restore it instead.
 *
 * **Rename** turns the name into a text field in the same row. Enter or leaving
 * the field saves the new name, and Escape keeps the old one. A blank or
 * unchanged name is not saved. Renaming is usually a small correction, so it
 * does not open a dialog.
 */
const Entry: FC<{
  document: DocumentSummary;
  onRename: (name: string) => Promise<void>;
  /** Archives the document, or restores it if it is already archived. */
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
 * Lists the import documents on one side of the list, current or archived, with
 * a form to start a new one.
 *
 * An import document is a named batch of publications being prepared for
 * import, saved on the server so work can continue later. Documents have no
 * owner or members, so anyone who may edit publications sees all of them and
 * may open any. The name is required because it is how people tell the batches
 * apart.
 *
 * Archiving a document moves it to the archived side of the list without
 * deleting it. The archived side can be read, and any document on it can be
 * restored, so a document archived by mistake is not lost.
 *
 * Each side of the list has its own route, and switching sides navigates to
 * it. **Show more** reads the next page starting after the last document shown,
 * instead of skipping a count, so a document that changes in between is not
 * shown twice.
 */
const DocumentList: FC<{
  /** Which side of the list is shown. */
  side: Side;
  /** The first page of that side, read on the server by the route. */
  first: DocumentPage;
  /** Reads a further page. Defaults to `list` from `document-remote`. */
  readMore?: typeof list;
  /** Creates a document with the given name. Defaults to `create`. */
  start?: (name: string) => Promise<DocumentSummary>;
  /** Rename, archive and restore a document, calling the server by default. */
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

  // After a rename, `replace` swaps in the summary the server returned. After an
  // archive or a restore, `remove` drops the document, because it now belongs
  // to the other side of the list. Neither reads the list again.
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

  // Navigates to the given side of the list. It does nothing if that side is
  // already shown.
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

      <div role="group" aria-label={t("which")} className="flex gap-2 pl-2">
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
        <p className="pl-[17px] text-sm text-gray-600">
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
            <div className="pl-2">
              <Button
                label={t("more")}
                variant="outline"
                width="fit"
                size="small"
                loading={reading}
                onClick={showMore}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export default DocumentList;
