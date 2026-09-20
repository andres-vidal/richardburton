"use client";

import Breadcrumb from "components/Breadcrumb";
import Button from "components/Button";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import { Link } from "i18n/navigation";
import { useRouter } from "i18n/navigation";
import {
  create,
  list,
  type WorkspaceSummary,
} from "modules/publication/workspace-remote";
import { useFormatter, useTranslations } from "next-intl";
import { FC, FormEvent, useEffect, useState } from "react";

/** One workspace in the list, with what it holds and when it last changed. */
const Entry: FC<{ workspace: WorkspaceSummary }> = ({ workspace }) => {
  const t = useTranslations("workspaces");
  const format = useFormatter();

  return (
    <li>
      <Link
        href={`/admin/publications/workspaces/${workspace.id}`}
        className="flex gap-4 justify-between items-baseline py-3 px-4 rounded-lg border border-gray-200 transition-colors hover:bg-gray-50 focus-ring"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium truncate">
            {workspace.name}
          </span>
          <span className="block text-xs text-gray-600">
            {t("rows", { count: workspace.rows })}
          </span>
        </span>
        <span className="text-xs text-gray-600 shrink-0 tabular-nums">
          {format.dateTime(new Date(workspace.updatedAt), "day")}
        </span>
      </Link>
    </li>
  );
};

/**
 * The workspaces a person may open, and the way to start another.
 *
 * A workspace is bulk-import work with a name and a home on the server, so it
 * survives the browser it was started in and can be handed to someone else.
 */
const WorkspaceHub: FC<{
  /** How the list is read. Defaults to asking the server. */
  read?: () => Promise<WorkspaceSummary[]>;
  /** How one is started. Defaults to asking the server. */
  start?: (name: string) => Promise<WorkspaceSummary>;
}> = ({ read = list, start = create }) => {
  const t = useTranslations("workspaces");
  const admin = useTranslations("admin");
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [name, setName] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    read().then(setWorkspaces);
  }, [read]);

  async function handleStart(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setStarting(true);
    try {
      const started = await start(name.trim());
      router.push(`/admin/publications/workspaces/${started.id}`);
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
          <form onSubmit={handleStart} className="flex gap-2 items-end">
            <label className="flex flex-col gap-1 grow">
              <span className="text-sm text-gray-600">{t("nameLabel")}</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("namePlaceholder")}
                aria-label={t("nameLabel")}
                className="py-2 px-3 w-full bg-white rounded border border-gray-300 transition-colors outline-none placeholder:text-sm focus:bg-gray-100 hover:bg-gray-100"
              />
            </label>
            <Button
              label={t("start")}
              type="submit"
              variant="primary"
              width="fit"
              size="medium"
              loading={starting}
              disabled={!name.trim() || starting}
            />
          </form>

          {workspaces === null ? (
            <p className="text-sm text-gray-600">{t("loading")}</p>
          ) : workspaces.length === 0 ? (
            <p className="text-sm text-gray-600">{t("none")}</p>
          ) : (
            <ul aria-label={t("title")} className="space-y-2">
              {workspaces.map((workspace) => (
                <Entry key={workspace.id} workspace={workspace} />
              ))}
            </ul>
          )}
        </div>
      }
    />
  );
};

export default WorkspaceHub;
