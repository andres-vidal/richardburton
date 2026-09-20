import { Suspense } from "react";
import Home from "./Home";
import { readIndex } from "app/publications/read";

// Server Component shell — the interactive index lives in the client `Home`,
// Suspense-wrapped because it reads `useSearchParams()` (App Router requires the
// boundary so static rendering can bail to the client cleanly).
//
// The database is read here, for the query in the address, so the rows arrive
// with the page. A publication shown *over* it is its own route — see app/@modal.
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
