"use client";

import BulkWorkspace from "components/BulkWorkspace";
import { useTranslations } from "next-intl";
import { use } from "react";

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useTranslations("workspaces");
  const { id } = use(params);

  return (
    <BulkWorkspace
      title={t("title")}
      description={t("description")}
      workspace={Number(id)}
    />
  );
}
