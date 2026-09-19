import Breadcrumb from "components/Breadcrumb";
import { getTranslations } from "next-intl/server";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import { withChanges } from "modules/publication/history";
import type { FullHistoryEntry } from "modules/publication/model";

import { get } from "app/api";
import PublicationHistoryFeed from "components/PublicationHistoryFeed";

export default async function PublicationHistoryPage() {
  const t = await getTranslations("admin");

  const crumbs = [
    { label: t("home"), href: "/" },
    { label: t("admin"), href: "/admin" },
    { label: t("historyTitle") },
  ];

  const { entries } = await get<{ entries: FullHistoryEntry[] }>(
    "/publications/history",
  );

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={crumbs} />
          <PageHeader
            title={t("historyTitle")}
            description={t("historyPage")}
          />
        </>
      }
      measure="aligned"
      content={<PublicationHistoryFeed entries={withChanges(entries)} />}
    />
  );
}
