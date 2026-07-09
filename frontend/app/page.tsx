import { Suspense } from "react";
import Home from "./Home";

// Server Component shell — the interactive index lives in the client `Home`,
// Suspense-wrapped because it reads `useSearchParams()` (App Router requires the
// boundary so static rendering can bail to the client cleanly).
export default function Page() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}
