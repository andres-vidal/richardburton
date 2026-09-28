import Breadcrumb from "components/Breadcrumb";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import VocabularyList from "components/VocabularyList";
import { getTranslations } from "next-intl/server";

export default async function VocabularyPage() {
  const t = await getTranslations("vocabulary");
  const admin = await getTranslations("admin");

  const crumbs = [
    { label: admin("home"), href: "/" },
    { label: admin("admin"), href: "/admin" },
    { label: t("title") },
  ];

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={crumbs} />
          <PageHeader title={t("title")} description={t("description")} />
        </>
      }
      content={<VocabularyList />}
    />
  );
}
