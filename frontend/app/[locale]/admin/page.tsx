"use client";

import AdminMenu from "components/AdminMenu";
import Breadcrumb from "components/Breadcrumb";
import { useTranslations } from "next-intl";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";

export default function AdminPage() {
  const t = useTranslations("admin");

  const crumbs = [{ label: t("home"), href: "/" }, { label: t("admin") }];

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={crumbs} />
          <PageHeader title={t("adminTitle")} />
        </>
      }
      measure="aligned"
      content={<AdminMenu />}
    />
  );
}
