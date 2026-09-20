import PublicationOverlay from "components/PublicationOverlay";

import { readPublication } from "app/publications/read";

/**
 * A publication read over whatever the reader was looking at.
 *
 * Intercepts the record's own address when the reader is already in the app, so
 * a row opens an overlay while the address itself opens the page. Its own route
 * segment, so the database underneath is neither re-read nor re-sent.
 *
 * The read is passed unawaited: the overlay opens on the click and the record
 * streams in.
 */
export default async function InterceptedPublication({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ search?: string }>;
}) {
  const [{ id }, { search }] = await Promise.all([params, searchParams]);

  return <PublicationOverlay view={readPublication(id, search)} />;
}
