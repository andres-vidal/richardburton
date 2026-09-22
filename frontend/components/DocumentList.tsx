"use client";

import Breadcrumb from "components/Breadcrumb";
import Button from "components/Button";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import TextInput from "components/TextInput";
import { Link, useRouter } from "i18n/navigation";
import {
  archive as archiveDocument,
  create,
  list,
  rename as renameDocument,
  unarchive,
  type DocumentPage,
  type DocumentSummary,
} from "modules/publication/document-remote";
import { useFormatter, useTranslations } from "next-intl";
import { FC, FormEvent, useCallback, useEffect, useState } from "react";

/** How many documents a page of the list holds. */
const PAGE = 20;

/** Which side of the list is being read. */
type Side = "current" | "archived";

/**
 * How the list is read when nothing stands in for the network.
 *
 * Declared here rather than as a default argument: a default argument is built
 * again on every render, and this is what an effect watches, so a fresh one
 * each time would read the list again for ever.
 */
const readFromServer = ({
  limit,
  offset,
  archived,
}: {
  limit: number;
  offset: number;
  archived: boolean;
}) => list({ limit, offset, ...(archived ? { archived: true } : {}) });

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
  onArchive: () => Promise<void>;
  onRestore: () => Promise<void>;
}> = ({ document, onRename, onArchive, onRestore }) => {
  const t = useTranslations("documents");
  const format = useFormatter();

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

    setWorking(true);
    try {
      await onRename(wanted);
    } finally {
      setWorking(false);
    }
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
              if (event.key === "Enter") commit();
              if (event.key === "Escape") {
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
            {format.dateTime(new Date(document.updatedAt), "day")}
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
          onClick={() => act(onRestore)}
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
            onClick={() => act(onArchive)}
          />
        </span>
      )}
    </li>
  );
};

/**
 * Every import document, and the way to start another.
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
 */
const DocumentList: FC<{
  /** How the list is read. Defaults to asking the server. */
  read?: (options: {
    limit: number;
    offset: number;
    archived: boolean;
  }) => Promise<DocumentPage>;
  /** How one is started. Defaults to asking the server. */
  start?: (name: string) => Promise<DocumentSummary>;
  /** How one is renamed, archived and put back. Default to asking the server. */
  rename?: (id: number, name: string) => Promise<DocumentSummary>;
  archive?: (id: number) => Promise<DocumentSummary>;
  restore?: (id: number) => Promise<DocumentSummary>;
}> = ({
  read = readFromServer,
  start = create,
  rename = renameDocument,
  archive = archiveDocument,
  restore = unarchive,
}) => {
  const t = useTranslations("documents");
  const admin = useTranslations("admin");
  const router = useRouter();

  const [side, setSide] = useState<Side>("current");
  const [page, setPage] = useState<DocumentPage | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [name, setName] = useState("");
  const [starting, setStarting] = useState(false);

  const refresh = useCallback(
    async (limit: number, which: Side) => {
      const found = await read({
        limit,
        offset: 0,
        archived: which === "archived",
      });

      setPage(found);
    },
    [read],
  );

  useEffect(() => {
    let current = true;

    read({ limit: shown, offset: 0, archived: side === "archived" }).then(
      (found) => {
        if (current) setPage(found);
      },
    );

    return () => {
      current = false;
    };
  }, [read, shown, side]);

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

  function look(which: Side) {
    setSide(which);
    setShown(PAGE);
    setPage(null);
  }

  const documents = page?.entries ?? null;
  const more = page ? page.total > page.entries.length : false;

  const crumbs = [
    { label: admin("home"), href: "/" },
    { label: admin("admin"), href: "/admin" },
    { label: t("title") },
  ];

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={crumbs} />
          <PageHeader title={t("title")} description={t("description")} />
        </>
      }
      content={
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

          {documents === null ? (
            <p className="text-sm text-gray-600">{t("loading")}</p>
          ) : documents.length === 0 ? (
            <p className="text-sm text-gray-600">
              {side === "archived" ? t("noneArchived") : t("none")}
            </p>
          ) : (
            <>
              <ul
                aria-label={
                  side === "archived" ? t("archivedList") : t("title")
                }
                className="space-y-2"
              >
                {documents.map((document) => (
                  <Entry
                    key={document.id}
                    document={document}
                    onRename={async (next) => {
                      await rename(document.id, next);
                      await refresh(shown, side);
                    }}
                    onArchive={async () => {
                      await archive(document.id);
                      await refresh(shown, side);
                    }}
                    onRestore={async () => {
                      await restore(document.id);
                      await refresh(shown, side);
                    }}
                  />
                ))}
              </ul>

              {more ? (
                <Button
                  label={t("more")}
                  variant="outline"
                  width="fit"
                  size="small"
                  onClick={() => setShown((held) => held + PAGE)}
                />
              ) : null}
            </>
          )}
        </div>
      }
    />
  );
};

export default DocumentList;
