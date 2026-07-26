import Breadcrumb from "components/Breadcrumb";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import { withChanges } from "modules/publication/history";
import type { FullHistoryEntry } from "modules/publication/model";

import { read } from "app/api";
import HistoryFeed from "./HistoryFeed";

const BREADCRUMB_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Admin", href: "/admin" },
  { label: "History" },
];

// A server component: the log is this page's whole content, so it is read
// before the first paint rather than after it. `withChanges` runs here too —
// turning the server's structural diff into labelled changes is work the
// browser no longer has to do.
export default async function PublicationHistoryPage() {
  const { entries } = await read<{ entries: FullHistoryEntry[] }>(
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
      content={<HistoryFeed entries={withChanges(entries)} />}
    />
  );
}
