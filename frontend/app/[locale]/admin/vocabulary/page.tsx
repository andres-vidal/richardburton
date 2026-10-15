import AdminPage from "components/AdminPage";
import VocabularyList from "components/VocabularyList";
import type { Kind } from "modules/vocabulary";
import { getTranslations } from "next-intl/server";

import { readNames } from "app/vocabulary/read";
import { admitEditors } from "../guard";

/**
 * Renders the names page with the publishers' names, or with `?kind=authors`
 * the names of translators and original authors. The names are read here, on
 * the server, and `VocabularyList` lists them for renaming.
 */
export default async function VocabularyPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  await admitEditors();

  const kind: Kind =
    (await searchParams).kind === "authors" ? "authors" : "publishers";

  const [t, names] = await Promise.all([
    getTranslations("vocabulary"),
    readNames(kind),
  ]);

  return (
    <AdminPage
      title={t("title")}
      description={t("description")}
      content={<VocabularyList kind={kind} names={names} />}
    />
  );
}
