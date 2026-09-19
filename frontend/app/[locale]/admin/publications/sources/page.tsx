import Breadcrumb from "components/Breadcrumb";
import { getTranslations } from "next-intl/server";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import SourcesBackfill from "components/SourcesBackfill";
import { readUnsourced } from "app/publications/read";

export default async function SourcesBackfillPage() {
  const t = await getTranslations("admin");

  const crumbs = [
    { label: t("home"), href: "/" },
    { label: t("admin"), href: "/admin" },
    { label: t("sourcesTitle") },
  ];

  const queue = await readUnsourced();

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={crumbs} />
          <PageHeader
            title={t("sourcesTitle")}
            description={t("sourcesPage")}
          />
        </>
      }
      content={<SourcesBackfill queue={queue} />}
    />
  );
}
