import { readUnsourced } from "app/publications/read";
import AdminPage from "components/AdminPage";
import SourcesBackfill from "components/SourcesBackfill";
import { getTranslations } from "next-intl/server";

import { admitEditors } from "../../guard";

/**
 * Renders the publications that cite no source with `SourcesBackfill`,
 * which steps through them to add sources.
 */
export default async function SourcesBackfillPage() {
  await admitEditors();

  const [t, queue] = await Promise.all([
    getTranslations("admin"),
    readUnsourced(),
  ]);

  return (
    <AdminPage
      title={t("sourcesTitle")}
      description={t("sourcesPage")}
      content={<SourcesBackfill queue={queue} />}
    />
  );
}
