import Breadcrumb from "components/Breadcrumb";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import type { DeletedPublicationEntry } from "modules/publication/model";

import { read } from "app/api";
import Trash from "./Trash";

const BREADCRUMB_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Admin", href: "/admin" },
  { label: "Deleted publications" },
];

export default async function DeletedPublicationsPage() {
  const { entries } = await read<{ entries: DeletedPublicationEntry[] }>(
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
      measure="centered"
      content={<Trash entries={entries} />}
    />
  );
}
