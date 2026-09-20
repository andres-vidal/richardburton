"use client";

import { revoke, setRole } from "modules/access/remote";
import { useSession } from "modules/session";
import { useFormatDate } from "modules/dates";
import type { UserRecord, UserRole } from "modules/users";
import { useRouter } from "i18n/navigation";
import { useTranslations } from "next-intl";
import { FC, useState } from "react";
import Button from "./Button";
import ConfirmationModal from "./ConfirmationModal";
import { useModal } from "./Modal";
import RoleMenu from "./RoleMenu";

const Entry: FC<{ user: UserRecord }> = ({ user }) => {
  const t = useTranslations("admin");
  const formatDate = useFormatDate();
  const router = useRouter();
  const confirmation = useModal();
  const [working, setWorking] = useState(false);
  const isSelf = user.email === useSession()?.email;

  async function change(role: UserRole) {
    setWorking(true);
    const changed = await setRole(user, role);
    setWorking(false);
    if (changed) router.refresh();
  }

  async function remove() {
    setWorking(true);
    const revoked = await revoke(user);
    setWorking(false);
    confirmation.close();
    if (revoked) router.refresh();
  }

  return (
    <li className="flex flex-wrap gap-3 items-center p-4 bg-white rounded-lg border border-gray-200">
      <div className="min-w-0 grow">
        <p className="font-medium text-gray-800 wrap-break-words">
          {user.email}
          {isSelf && (
            <span className="ml-2 text-xs text-gray-500">{t("you")}</span>
          )}
        </p>
        <p className="text-xs text-gray-500">
          {t("roleAndJoined", {
            role: user.role,
            date: formatDate(user.insertedAt),
          })}
        </p>
      </div>

      <RoleMenu
        value={user.role}
        label={t("roleFor", { email: user.email })}
        disabled={working || isSelf}
        onChange={change}
      />

      <Button
        label={t("revoke")}
        variant="danger"
        width="fit"
        size="field"
        loading={working}
        disabled={working || isSelf}
        onClick={() => confirmation.open()}
      />

      <ConfirmationModal
        isOpen={confirmation.isOpen}
        title={t("revokeTitle")}
        message={t("revokeMessage", { email: user.email })}
        confirmLabel={t("revoke")}
        loading={working}
        onConfirm={remove}
        onCancel={confirmation.close}
      />
    </li>
  );
};

/**
 * Everyone with access, and what they may do.
 *
 * Your own row is shown but cannot be changed from here: another admin can
 * demote or remove you, and having to ask is the point — it is the difference
 * between a considered decision and a slip that locks you out. The server
 * refuses it too; this only saves the round trip.
 */
const AccessList: FC<{ users: UserRecord[] }> = ({ users }) => (
  <ul className="flex flex-col gap-2">
    {users.map((user) => (
      <Entry key={user.email} user={user} />
    ))}
  </ul>
);

export default AccessList;
