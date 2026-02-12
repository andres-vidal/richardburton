import { Suspense } from "react";
import HomeContent from "./home-content";

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
