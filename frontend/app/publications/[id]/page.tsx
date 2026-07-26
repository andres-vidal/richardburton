import Breadcrumb from "components/Breadcrumb";
import Layout from "components/Layout";
import PublicationDetail, {
  PublicationHeading,
} from "components/PublicationDetail";
import type { Publication } from "modules/publication/model";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { get } from "app/api";

/**
 * Read once per request even though the page and its metadata both ask: `cache`
 * memoises for the lifetime of the render, so a title and a body do not cost
 * two round trips.
 *
 * A missing record — never existed, or deleted — is a 404 rather than an empty
 * page, so a stale link says so.
 */
const publication = cache(async (id: string): Promise<Publication> => {
  try {
    return await get<Publication>(`/publications/${id}`);
  } catch {
    notFound();
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { title, authors, originalTitle, originalAuthors, year } =
    await publication((await params).id);

  // What the record is, in the words a search result has room for.
  return {
    title,
    description: `${title} — ${originalTitle} by ${originalAuthors}, translated by ${authors}, ${year}.`,
  };
}

// A publication as its own document, read on the server. The modal over the
// index shows the same view; this is the address it has when nobody is
// browsing — a link that works on its own, without the catalogue behind it.
export default async function PublicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const record = await publication((await params).id);

  return (
    <Layout
      measure="centered"
      subheader={
        <>
          <Breadcrumb
            items={[{ label: "Home", href: "/" }, { label: record.title }]}
          />
          <div className="py-2">
            <PublicationHeading publication={record} />
          </div>
        </>
      }
      content={<PublicationDetail publication={record} />}
    />
  );
}
