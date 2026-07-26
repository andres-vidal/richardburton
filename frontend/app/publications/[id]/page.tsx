import Breadcrumb from "components/Breadcrumb";
import Layout from "components/Layout";
import PublicationDetail, {
  PublicationHeading,
} from "components/PublicationDetail";
import { PublicationStoreProvider } from "modules/publication/workspace";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { readPublication } from "../read";

/** A missing record — never existed, or deleted — is a 404 rather than an empty
 * page, so a stale link says so. */
async function read(id: string) {
  return (await readPublication(id)) ?? notFound();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { publication } = await read((await params).id);
  const { title, authors, originalTitle, originalAuthors, year } = publication;

  // What the record is, in the words a search result has room for.
  return {
    title,
    description: `${title} — ${originalTitle} by ${originalAuthors}, translated by ${authors}, ${year}.`,
  };
}

export default async function PublicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { publication, history } = await read((await params).id);

  return (
    <Layout
      measure="aligned"
      subheader={
        <>
          <Breadcrumb
            items={[{ label: "Home", href: "/" }, { label: publication.title }]}
          />
          <div className="py-2">
            <PublicationHeading publication={publication} />
          </div>
        </>
      }
      content={
        <PublicationStoreProvider>
          <PublicationDetail publication={publication} history={history} />
        </PublicationStoreProvider>
      }
    />
  );
}
