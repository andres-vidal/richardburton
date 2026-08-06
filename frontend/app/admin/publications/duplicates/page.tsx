import { readDuplicates } from "app/publications/read";
import Breadcrumb from "components/Breadcrumb";
import DuplicateReview from "components/DuplicateReview";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";

const BREADCRUMB_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Admin", href: "/admin" },
  { label: "Review duplicates" },
];

export default async function DuplicateReviewPage() {
  const { clusters } = await readDuplicates();

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={BREADCRUMB_ITEMS} />
          <PageHeader
            title="Review duplicates"
            description="Records that look like the same publication entered more than once. Merge them, or say they are different — an answer is remembered."
          />
        </>
      }
      content={<DuplicateReview clusters={clusters} />}
    />
  );
}
