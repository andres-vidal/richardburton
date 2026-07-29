import { Suspense } from "react";
import Home from "./Home";
import { readIndex } from "./publications/read";

// Server Component shell — the interactive index lives in the client `Home`,
// Suspense-wrapped because it reads `useSearchParams()` (App Router requires the
// boundary so static rendering can bail to the client cleanly).
//
// The database is read here, for the query in the address, so the rows are in
// the first response rather than fetched again once it lands. A publication
// shown *over* this page is its own route — see app/@modal.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;

  return (
    <Suspense>
      <Home index={await readIndex(search)} />
    </Suspense>
  );
}
