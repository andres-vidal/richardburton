import { Suspense } from "react";
import Home from "./Home";
import { readIndex } from "app/publications/read";

/**
 * The index page. It reads the first page of the database for the `search` in
 * the address, so the rows arrive with the page, and renders them with `Home`.
 *
 * `Home` reads `useSearchParams()`, which needs a `Suspense` boundary above it.
 * A publication opened over the index is the `@modal` slot's route.
 */
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
