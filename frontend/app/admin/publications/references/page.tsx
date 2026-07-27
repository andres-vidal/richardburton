import Breadcrumb from "components/Breadcrumb";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import ReferencesBackfill from "components/ReferencesBackfill";
import { readUnreferenced } from "app/publications/read";

const BREADCRUMB_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Admin", href: "/admin" },
  { label: "Backfill references" },
];

export default async function ReferencesBackfillPage() {
  const queue = await readUnreferenced();

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
      content={<ReferencesBackfill queue={queue} />}
    />
  );
}
