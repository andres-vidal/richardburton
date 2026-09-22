"use client";

import Breadcrumb from "components/Breadcrumb";
import Button from "components/Button";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import TextInput from "components/TextInput";
import { Link } from "i18n/navigation";
import { useRouter } from "i18n/navigation";
import {
  create,
  list,
  type DocumentSummary,
} from "modules/publication/document-remote";
import { useFormatter, useTranslations } from "next-intl";
import { FC, FormEvent, useEffect, useState } from "react";

/** One document in the list, with what it holds and when it last changed. */
const Entry: FC<{ document: DocumentSummary }> = ({ document }) => {
  const t = useTranslations("documents");
  const format = useFormatter();

  return (
    <li>
      <Link
        href={`/admin/publications/documents/${document.id}`}
        className="flex gap-4 justify-between items-baseline py-3 px-4 rounded-lg border border-gray-200 transition-colors hover:bg-gray-50 focus-ring"
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
 */
const DocumentList: FC<{
  /** How the list is read. Defaults to asking the server. */
  read?: () => Promise<DocumentSummary[]>;
  /** How one is started. Defaults to asking the server. */
  start?: (name: string) => Promise<DocumentSummary>;
}> = ({ read = list, start = create }) => {
  const t = useTranslations("documents");
  const admin = useTranslations("admin");
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [name, setName] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    read().then(setDocuments);
  }, [read]);

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

          {documents === null ? (
            <p className="text-sm text-gray-600">{t("loading")}</p>
          ) : documents.length === 0 ? (
            <p className="text-sm text-gray-600">{t("none")}</p>
          ) : (
            <ul aria-label={t("title")} className="space-y-2">
              {documents.map((document) => (
                <Entry key={document.id} document={document} />
              ))}
            </ul>
          )}
        </div>
      }
    />
  );
};

export default DocumentList;
