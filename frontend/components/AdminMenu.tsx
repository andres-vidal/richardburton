"use client";

import Link from "next/link";
import { FC } from "react";

/** The admin actions, as a hub of cards. New admin tools slot in here. */
const ACTIONS = [
  {
    href: "/admin/publications/new",
    title: "Add publications",
    description:
      "Bulk-enter or upload new publications, review them, and insert them into the database.",
  },
  {
    href: "/admin/publications/references",
    title: "Backfill references",
    description:
      "Work through the publications that are missing sources and add their provenance.",
  },
  {
    href: "/admin/publications/history",
    title: "History",
    description:
      "Every change to the catalogue — who created, edited, deleted, or restored what, and when.",
  },
  {
    href: "/admin/publications/deleted",
    title: "Deleted publications",
    description:
      "The records currently deleted from the catalogue, restorable exactly as they were.",
  },
] as const;

const AdminMenu: FC = () => (
  <ul className="grid gap-4 sm:grid-cols-2">
    {ACTIONS.map(({ href, title, description }) => (
      <li key={href} className="contents">
        <Link
          href={href}
          className="flex flex-col gap-1 p-5 h-full bg-white rounded-lg border border-gray-200 transition-colors hover:border-indigo-400 hover:shadow-sm"
        >
          <span className="font-medium text-indigo-700">{title}</span>
          <span className="text-sm text-gray-600">{description}</span>
        </Link>
      </li>
    ))}
  </ul>
);

export default AdminMenu;
