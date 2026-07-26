import { Suspense } from "react";
import Home from "./Home";
import { readPublication } from "./publications/read";

// Server Component shell — the interactive index lives in the client `Home`,
// Suspense-wrapped because it reads `useSearchParams()` (App Router requires the
// boundary so static rendering can bail to the client cleanly).
//
// The publication the URL names is read here, from the address rather than from
// whatever the index happens to have loaded. The promise is handed over
// unawaited: the overlay opens on the URL alone and the record streams into it,
// so a click is answered at once.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ publication?: string }>;
}) {
  const { publication } = await searchParams;

  return (
    <Suspense>
      <Home opened={publication ? readPublication(publication) : undefined} />
    </Suspense>
  );
}
