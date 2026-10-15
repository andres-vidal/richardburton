"use client";

import { useTranslations } from "next-intl";
import { FC, ReactNode } from "react";
import Breadcrumb from "./Breadcrumb";
import Layout from "./Layout";
import PageHeader from "./PageHeader";

type Props = {
  /** The page's name. It is the last crumb of the breadcrumb and the heading. */
  title: string;
  /** A sentence under the heading that says what the page is for. */
  description?: string;
  /** Controls or status shown at the end of the heading's row. */
  aside?: ReactNode;
  /** How the page is laid out across the viewport, as `Layout` takes it. */
  measure?: "full" | "aligned";
  content: ReactNode;
  footer?: ReactNode;
};

/**
 * Renders a page of the admin area in `Layout`: a breadcrumb from the home page
 * through the admin index to `title`, a `PageHeader` with the title and the
 * description, and then the content. `aside` is shown at the end of the
 * heading's row, and `footer` in the layout's sticky footer.
 */
const AdminPage: FC<Props> = ({
  title,
  description,
  aside,
  measure,
  content,
  footer,
}) => {
  const t = useTranslations("admin");

  const crumbs = [
    { label: t("home"), href: "/" },
    { label: t("admin"), href: "/admin" },
    { label: title },
  ];

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={crumbs} />
          <div className="flex gap-4 justify-between items-center">
            <PageHeader title={title} description={description} />
            {aside && (
              <span className="flex gap-3 items-center shrink-0">{aside}</span>
            )}
          </div>
        </>
      }
      measure={measure}
      content={content}
      footer={footer}
    />
  );
};

export default AdminPage;
