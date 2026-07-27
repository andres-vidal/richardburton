import Breadcrumb from "components/Breadcrumb";
import Layout from "components/Layout";
import PublicationDetail, {
  PublicationHeading,
} from "components/PublicationDetail";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { readPublication } from "../read";

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
        <PublicationDetail publication={publication} history={history} />
      }
    />
  );
}
