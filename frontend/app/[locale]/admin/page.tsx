import AdminMenu from "components/AdminMenu";
import Breadcrumb from "components/Breadcrumb";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import { getTranslations } from "next-intl/server";

/**
 * The admin index. It lists the admin pages with `AdminMenu`, under a
 * breadcrumb from the home page.
 */
export default async function AdminIndexPage() {
  const t = await getTranslations("admin");

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb
            items={[{ label: t("home"), href: "/" }, { label: t("admin") }]}
          />
          <PageHeader title={t("adminTitle")} />
        </>
      }
      measure="aligned"
      content={<AdminMenu />}
    />
  );
}
