import PublicationOverlay from "components/PublicationOverlay";

import { readPublication } from "../../../publications/read";

/**
 * A publication read over whatever the reader was looking at.
 *
 * The same address as its own page — this intercepts it when the reader is
 * already in the app, so following a link from the catalogue opens an overlay
 * while arriving at the address directly opens the page. Being its own route
 * segment, opening it renders *this* and leaves the catalogue underneath alone:
 * the rows are not read again, and not sent again.
 *
 * The read is handed over unawaited, so the overlay opens on the click and the
 * record streams into it.
 */
export default async function InterceptedPublication({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <PublicationOverlay view={readPublication(id)} />;
}
