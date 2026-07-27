import { Suspense } from "react";
import Home from "./Home";
import { readIndex, readPublication } from "./publications/read";

// Server Component shell — the interactive index lives in the client `Home`,
// Suspense-wrapped because it reads `useSearchParams()` (App Router requires the
// boundary so static rendering can bail to the client cleanly).
//
// Both of the page's reads come from its address. The catalogue is awaited, so
// the rows are in the first response rather than fetched again once it lands;
// the publication an overlay would show is handed over unawaited, so the overlay
// opens on the URL alone and the record streams into it.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ publication?: string; search?: string }>;
}) {
  const { publication, search } = await searchParams;

  return (
    <Suspense>
      <Home
        index={await readIndex(search)}
        opened={publication ? readPublication(publication) : undefined}
      />
    </Suspense>
  );
}
