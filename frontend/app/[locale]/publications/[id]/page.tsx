import { routing } from "i18n/routing";
import Breadcrumb from "components/Breadcrumb";
import Layout from "components/Layout";
import PublicationDetail, {
  PublicationHeading,
} from "components/PublicationDetail";
import PublicationOverlay from "components/PublicationOverlay";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import Home from "../../Home";
import { readIndex, readPublication } from "app/publications/read";

async function read(id: string, search?: string) {
  return (await readPublication(id, search)) ?? notFound();
}

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
    alternates: {
      canonical: `/${locale}/publications/${publication.id}`,
      languages: Object.fromEntries(
        routing.locales.map((other) => [
          other,
          `/${other}/publications/${publication.id}`,
        ]),
      ),
    },
  };
}

/**
 * A publication at its own address.
 *
 * The same address serves two things, and the URL says which: on its own it is
 * the record's page, and marked `?modal` it is the record shown over the
 * database — what the reader was looking at when they followed a row. Following
 * a row is intercepted into an overlay and never reaches here; reloading it does,
 * and finds the mark, so the reader gets back what they were looking at instead
 * of losing the database behind them.
 *
 * A link shared from the copy button carries no mark: someone opening it cold
 * has no database to be shown over, and gets the record itself.
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
          closeTo={query.search ? `/?search=${query.search}` : "/"}
        />
      </>
    );
  }

  const { publication, history } = await read(id, query.search);

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
        <PublicationDetail publication={publication} history={history} />
      }
    />
  );
}
