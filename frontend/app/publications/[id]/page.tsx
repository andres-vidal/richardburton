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
