"use client";

import { useSession } from "modules/session";
import { User, type UserRole } from "modules/users";
import Link from "next/link";
import { FC } from "react";

/**
 * The admin actions, as a hub of cards. New admin tools slot in here, each
 * saying the least role that may reach it — the same role its route asks for.
 */
const ACTIONS: {
  href: string;
  title: string;
  description: string;
  role: UserRole;
}[] = [
  {
    href: "/admin/publications/new",
    title: "Add publications",
    description:
      "Bulk-enter or upload new publications, review them, and insert them into the database.",
    role: "contributor",
  },
  {
    href: "/admin/publications/references",
    title: "Backfill references",
    description:
      "Work through the publications that are missing sources and add their provenance.",
    role: "contributor",
  },
  {
    href: "/admin/publications/history",
    title: "History",
    description:
      "Every change to the catalogue — who created, edited, deleted, or restored what, and when.",
    role: "contributor",
  },
  {
    href: "/admin/publications/deleted",
    title: "Deleted publications",
    description:
      "The records currently deleted from the catalogue, restorable exactly as they were.",
    role: "contributor",
  },
  {
    href: "/admin/users",
    title: "Access",
    description:
      "Who can work on the catalogue, what they may do, and who has been invited.",
    role: "admin",
  },
];

const AdminMenu: FC = () => {
  const session = useSession();
  const actions = ACTIONS.filter(({ role }) => User.holds(session, role));

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {actions.map(({ href, title, description }) => (
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
};

export default AdminMenu;
