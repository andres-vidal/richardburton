import Breadcrumb from "components/Breadcrumb";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import type { DeletedPublicationEntry } from "modules/publication/model";

import { get } from "app/api";
import DeletedPublications from "components/DeletedPublications";

const BREADCRUMB_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Admin", href: "/admin" },
  { label: "Deleted publications" },
];

export default async function DeletedPublicationsPage() {
  const { entries } = await get<{ entries: DeletedPublicationEntry[] }>(
    "/publications/deleted",
  );

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={BREADCRUMB_ITEMS} />
          <PageHeader
            title="Deleted publications"
            description="Records removed from the catalogue. Restoring brings one back exactly as it was."
          />
        </>
      }
      measure="aligned"
      content={<DeletedPublications entries={entries} />}
    />
  );
}
