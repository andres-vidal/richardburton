import { readDistinctions, readDuplicates } from "app/publications/read";
import Breadcrumb from "components/Breadcrumb";
import { getTranslations } from "next-intl/server";
import DuplicateReview from "components/DuplicateReview";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";

export default async function DuplicateReviewPage() {
  const t = await getTranslations("admin");

  const crumbs = [
    { label: t("home"), href: "/" },
    { label: t("admin"), href: "/admin" },
    { label: t("duplicatesTitle") },
  ];

  const [{ clusters }, distinctions] = await Promise.all([
    readDuplicates(),
    readDistinctions(),
  ]);

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={crumbs} />
          <PageHeader
            title={t("duplicatesTitle")}
            description={t("duplicatesPage")}
          />
        </>
      }
      content={
        <DuplicateReview clusters={clusters} distinctions={distinctions} />
      }
    />
  );
}
