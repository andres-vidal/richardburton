import Breadcrumb from "components/Breadcrumb";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import SourcesBackfill from "components/SourcesBackfill";
import { readUnsourced } from "app/publications/read";

const BREADCRUMB_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Admin", href: "/admin" },
  { label: "Backfill sources" },
];

export default async function SourcesBackfillPage() {
  const queue = await readUnsourced();

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={BREADCRUMB_ITEMS} />
          <PageHeader
            title="Backfill sources"
            description="Add sources to publications that are missing them."
          />
        </>
      }
      content={<SourcesBackfill queue={queue} />}
    />
  );
}
