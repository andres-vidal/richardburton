import AdminPage from "components/AdminPage";
import DeletedPublications from "components/DeletedPublications";
import type { DeletedPublicationEntry } from "modules/publication/model";
import { getTranslations } from "next-intl/server";

import { get } from "app/api";
import { admitEditors } from "../../guard";

/**
 * Lists the publications that are deleted now, the most recently deleted first,
 * with `DeletedPublications`, which offers to restore each.
 */
export default async function DeletedPublicationsPage() {
  await admitEditors();

  const [t, { entries }] = await Promise.all([
    getTranslations("admin"),
    get<{ entries: DeletedPublicationEntry[] }>("/publications/deleted"),
  ]);

  return (
    <AdminPage
      title={t("deletedTitle")}
      description={t("deletedPage")}
      measure="aligned"
      content={<DeletedPublications entries={entries} />}
    />
  );
}
