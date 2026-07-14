import { Suspense } from "react";
import Home from "../Home";

export default function Page() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}
