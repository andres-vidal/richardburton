import Breadcrumb from "components/Breadcrumb";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import { withChanges } from "modules/publication/history";
import type { FullHistoryEntry } from "modules/publication/model";

import { get } from "app/api";
import PublicationHistoryFeed from "components/PublicationHistoryFeed";

const BREADCRUMB_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Admin", href: "/admin" },
  { label: "History" },
];

export default async function PublicationHistoryPage() {
  const { entries } = await get<{ entries: FullHistoryEntry[] }>(
    "/publications/history",
  );

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={BREADCRUMB_ITEMS} />
          <PageHeader
            title="History"
            description="Every change to the catalogue — who did what, and when. Any change still reconcilable with the current state can be undone."
          />
        </>
      }
      measure="centered"
      content={<PublicationHistoryFeed entries={withChanges(entries)} />}
    />
  );
}
