"use client";

import Breadcrumb from "components/Breadcrumb";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import ReferencesBackfill from "components/ReferencesBackfill";

const BREADCRUMB_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Admin", href: "/admin" },
  { label: "Backfill references" },
];

export default function ReferencesBackfillPage() {
  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={BREADCRUMB_ITEMS} />
          <PageHeader
            title="Backfill references"
            description="Add sources to publications that are missing them."
          />
        </>
      }
      content={<ReferencesBackfill />}
    />
  );
}
