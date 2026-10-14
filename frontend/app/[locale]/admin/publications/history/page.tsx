import AdminPage from "components/AdminPage";
import PublicationHistoryFeed from "components/PublicationHistoryFeed";
import { withChanges } from "modules/publication/history";
import type { FullHistoryEntry } from "modules/publication/model";
import { getTranslations } from "next-intl/server";

import { get } from "app/api";
import { admitEditors } from "../../guard";

/**
 * Renders the history of every publication with `PublicationHistoryFeed`,
 * each entry with the changes it made.
 */
export default async function PublicationHistoryPage() {
  await admitEditors();

  const [t, { entries }] = await Promise.all([
    getTranslations("admin"),
    get<{ entries: FullHistoryEntry[] }>("/publications/history"),
  ]);

  return (
    <AdminPage
      title={t("historyTitle")}
      description={t("historyPage")}
      measure="aligned"
      content={<PublicationHistoryFeed entries={withChanges(entries)} />}
    />
  );
}
