"use client";

import BulkWorkspace from "components/BulkWorkspace";
import { show } from "modules/publication/workspace-remote";
import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useTranslations("workspaces");
  const { id } = use(params);
  const workspace = Number(id);

  // The name is what tells one workspace from another, and it belongs to the
  // server rather than to the document — so it is read rather than restored.
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    show(workspace).then(({ workspace: found }) => setName(found.name));
  }, [workspace]);

  return (
    <BulkWorkspace
      title={name ?? t("title")}
      description={t("description")}
      workspace={workspace}
    />
  );
}
