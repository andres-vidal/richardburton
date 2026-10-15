import Breadcrumb from "components/Breadcrumb";
import Layout from "components/Layout";
import PublicationDetail, {
  PublicationHeading,
} from "components/PublicationDetail";
import PublicationOverlay from "components/PublicationOverlay";
import { searchHref } from "modules/publication/model";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import Home from "../../Home";
import { alternates } from "app/alternates";
import { readIndex, readPublication } from "app/publications/read";

// Returns `readPublication(id, search)`, or renders the 404 page when there is
// no such publication.
async function read(id: string, search?: string) {
  return (await readPublication(id, search)) ?? notFound();
}

/**
 * Returns the publication's title, a description naming the work it
 * translates, and its address in every locale.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{ search?: string }>;
}): Promise<Metadata> {
  const [{ id, locale }, query] = await Promise.all([params, searchParams]);
  const { publication } = await read(id, query.search);
  const { title, authors, originalTitle, originalAuthors, year } = publication;
  const t = await getTranslations("metadata");

  return {
    title,
    description: t("publicationDescription", {
      title,
      originalTitle,
      originalAuthors: String(originalAuthors),
      authors: String(authors),
      year,
    }),
    alternates: alternates(`/publications/${publication.id}`, locale),
  };
}

/**
 * A publication at its own address.
 *
 * `?modal` means it is shown over the database. Following a row is intercepted
 * into an overlay and never reaches here; reloading one does, and the mark is
 * what restores the database behind it.
 *
 * A shared link carries no mark, so it opens the page itself.
 */
export default async function PublicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{ modal?: string; search?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  if (query.modal !== undefined) {
    const [view, index] = await Promise.all([
      read(id, query.search),
      readIndex(query.search),
    ]);

    return (
      <>
        <Home index={index} />
        <PublicationOverlay
          view={Promise.resolve(view)}
          closeTo={searchHref(query.search)}
        />
      </>
    );
  }

  const [t, { publication, history }] = await Promise.all([
    getTranslations("admin"),
    read(id, query.search),
  ]);

  return (
    <Layout
      measure="aligned"
      subheader={
        <>
          <Breadcrumb
            items={[
              { label: t("home"), href: "/" },
              { label: publication.title },
            ]}
          />
          <div className="py-2">
            <PublicationHeading publication={publication} />
          </div>
        </>
      }
      content={
        <PublicationDetail publication={publication} history={history} />
      }
    />
  );
}
