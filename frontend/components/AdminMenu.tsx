"use client";

import AddIcon from "assets/add-circle.svg";
import DuplicateIcon from "assets/copy.svg";
import HistoryIcon from "assets/history.svg";
import SourcesIcon from "assets/numbered-list.svg";
import PeopleIcon from "assets/people.svg";
import RestoreTrashIcon from "assets/restore-trash.svg";
import { useSession } from "modules/session";
import { User, type UserRole } from "modules/users";
import { Link } from "i18n/navigation";
import { useTranslations } from "next-intl";
import { FC, SVGProps } from "react";

/**
 * The admin actions, as a hub of cards. New admin tools slot in here, each
 * saying the least role that may reach it — the same role its route asks for.
 */
const ACTIONS: {
  href: string;
  key: string;
  role: UserRole;
  Icon: FC<SVGProps<SVGSVGElement>>;
}[] = [
  {
    href: "/admin/publications/new",
    Icon: AddIcon,
    key: "new",
    role: "contributor",
  },
  {
    href: "/admin/publications/sources",
    Icon: SourcesIcon,
    key: "sources",
    role: "contributor",
  },
  {
    href: "/admin/publications/duplicates",
    Icon: DuplicateIcon,
    key: "duplicates",
    role: "contributor",
  },
  {
    href: "/admin/publications/history",
    Icon: HistoryIcon,
    key: "history",
    role: "contributor",
  },
  {
    href: "/admin/publications/deleted",
    Icon: RestoreTrashIcon,
    key: "deleted",
    role: "contributor",
  },
  {
    href: "/admin/users",
    Icon: PeopleIcon,
    key: "access",
    role: "admin",
  },
];

const AdminMenu: FC = () => {
  const t = useTranslations("admin");
  const session = useSession();
  const actions = ACTIONS.filter(({ role }) => User.holds(session, role));

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {actions.map(({ href, key, Icon }) => (
        <li key={href} className="contents">
          <Link
            href={href}
            className="flex gap-4 items-start p-5 h-full bg-white rounded-lg border border-gray-200 transition-colors hover:border-indigo-400 hover:shadow-sm"
          >
            <Icon aria-hidden className="w-6 h-6 shrink-0 text-indigo-700" />
            <span className="flex flex-col gap-1">
              <span className="font-medium text-indigo-700">
                {t(`${key}Title`)}
              </span>
              <span className="text-sm text-gray-600">
                {t(`${key}Description`)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default AdminMenu;
