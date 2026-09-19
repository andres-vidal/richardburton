import Breadcrumb from "components/Breadcrumb";
import { getTranslations } from "next-intl/server";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import type { DeletedPublicationEntry } from "modules/publication/model";

import { get } from "app/api";
import DeletedPublications from "components/DeletedPublications";

export default async function DeletedPublicationsPage() {
  const t = await getTranslations("admin");

  const crumbs = [
    { label: t("home"), href: "/" },
    { label: t("admin"), href: "/admin" },
    { label: t("deletedTitle") },
  ];

  const { entries } = await get<{ entries: DeletedPublicationEntry[] }>(
    "/publications/deleted",
  );

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={crumbs} />
          <PageHeader
            title={t("deletedTitle")}
            description={t("deletedPage")}
          />
        </>
      }
      measure="aligned"
      content={<DeletedPublications entries={entries} />}
    />
  );
}
