"use client";

import AddIcon from "assets/add-circle.svg";
import DuplicateIcon from "assets/copy.svg";
import HistoryIcon from "assets/history.svg";
import SourcesIcon from "assets/numbered-list.svg";
import PeopleIcon from "assets/people.svg";
import RestoreTrashIcon from "assets/restore-trash.svg";
import { useSession } from "modules/session";
import { User, type UserRole } from "modules/users";
import Link from "next/link";
import { FC, SVGProps } from "react";

/**
 * The admin actions, as a hub of cards. New admin tools slot in here, each
 * saying the least role that may reach it — the same role its route asks for.
 */
const ACTIONS: {
  href: string;
  title: string;
  description: string;
  role: UserRole;
  Icon: FC<SVGProps<SVGSVGElement>>;
}[] = [
  {
    href: "/admin/publications/new",
    Icon: AddIcon,
    title: "Add publications",
    description:
      "Bulk-enter or upload new publications, review them, and insert them into the database.",
    role: "contributor",
  },
  {
    href: "/admin/publications/sources",
    Icon: SourcesIcon,
    title: "Backfill sources",
    description:
      "Work through the publications that are missing sources and add their provenance.",
    role: "contributor",
  },
  {
    href: "/admin/publications/duplicates",
    Icon: DuplicateIcon,
    title: "Review duplicates",
    description:
      "Records that look like the same publication entered twice — merge them, or say they are different.",
    role: "contributor",
  },
  {
    href: "/admin/publications/history",
    Icon: HistoryIcon,
    title: "History",
    description:
      "Every change to the database — who created, edited, deleted, or restored what, and when.",
    role: "contributor",
  },
  {
    href: "/admin/publications/deleted",
    Icon: RestoreTrashIcon,
    title: "Deleted publications",
    description:
      "The records currently deleted from the database, restorable exactly as they were.",
    role: "contributor",
  },
  {
    href: "/admin/users",
    Icon: PeopleIcon,
    title: "Access",
    description:
      "Who can work on the database, what they may do, and who has been invited.",
    role: "admin",
  },
];

const AdminMenu: FC = () => {
  const session = useSession();
  const actions = ACTIONS.filter(({ role }) => User.holds(session, role));

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {actions.map(({ href, title, description, Icon }) => (
        <li key={href} className="contents">
          <Link
            href={href}
            className="flex gap-4 items-start p-5 h-full bg-white rounded-lg border border-gray-200 transition-colors hover:border-indigo-400 hover:shadow-sm"
          >
            <Icon aria-hidden className="w-6 h-6 shrink-0 text-indigo-700" />
            <span className="flex flex-col gap-1">
              <span className="font-medium text-indigo-700">{title}</span>
              <span className="text-sm text-gray-600">{description}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default AdminMenu;
