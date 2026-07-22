"use client";

import AdminMenu from "components/AdminMenu";
import Breadcrumb from "components/Breadcrumb";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";

const BREADCRUMB_ITEMS = [{ label: "Home", href: "/" }, { label: "Admin" }];

export default function AdminPage() {
  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={BREADCRUMB_ITEMS} />
          <PageHeader title="Admin tools" />
        </>
      }
      content={<AdminMenu />}
    />
  );
}
