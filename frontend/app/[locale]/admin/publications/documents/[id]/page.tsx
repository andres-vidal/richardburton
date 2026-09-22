"use client";

import BulkWorkspace from "components/BulkWorkspace";
import { show } from "modules/publication/document-remote";
import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";

export default function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useTranslations("documents");
  const { id } = use(params);
  const document = Number(id);

  // The name is what tells one document from another, and it belongs to the
  // server rather than to the content — so it is read rather than restored.
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    show(document).then((found) => setName(found.name));
  }, [document]);

  return (
    <BulkWorkspace
      title={name ?? t("title")}
      description={t("description")}
      document={document}
    />
  );
}
