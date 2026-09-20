"use client";

import BulkWorkspace from "components/BulkWorkspace";
import { useTranslations } from "next-intl";

export default function NewPublicationsPage() {
  const t = useTranslations("admin");

  return <BulkWorkspace title={t("newTitle")} description={t("newPage")} />;
}
