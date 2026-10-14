import { readDistinctions, readDuplicates } from "app/publications/read";
import AdminPage from "components/AdminPage";
import DuplicateReview from "components/DuplicateReview";
import { getTranslations } from "next-intl/server";

import { admitEditors } from "../../guard";

/**
 * Renders the review of possible duplicates with `DuplicateReview`: the
 * clusters of records that may be one publication, and the pairs already
 * ruled apart.
 */
export default async function DuplicateReviewPage() {
  await admitEditors();

  const [t, { clusters }, distinctions] = await Promise.all([
    getTranslations("admin"),
    readDuplicates(),
    readDistinctions(),
  ]);

  return (
    <AdminPage
      title={t("duplicatesTitle")}
      description={t("duplicatesPage")}
      content={
        <DuplicateReview clusters={clusters} distinctions={distinctions} />
      }
    />
  );
}
