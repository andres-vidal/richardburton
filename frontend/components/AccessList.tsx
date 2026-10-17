"use client";

import { revoke, setRole } from "modules/access/remote";
import { useSession } from "modules/session";
import { useFormatDate } from "modules/dates";
import type { UserRecord, UserRole } from "modules/users";
import { useTranslations } from "next-intl";
import { FC } from "react";
import { useMutation } from "utils/useMutation";
import Button from "./Button";
import ConfirmationModal from "./ConfirmationModal";
import { useModal } from "./Modal";
import RoleMenu from "./RoleMenu";

/**
 * One person's row: their address, role and join date, a menu to change the
 * role, and a button to revoke access after a confirmation. Both controls are
 * disabled while a change runs, and on the reader's own row.
 */
const Entry: FC<{ user: UserRecord }> = ({ user }) => {
  const t = useTranslations("admin");
  const formatDate = useFormatDate();
  const confirmation = useModal();
  const { pending: working, run } = useMutation();
  const isSelf = user.email === useSession()?.email;

  function change(role: UserRole) {
    run(() => setRole(user, role));
  }

  function remove() {
    run(async () => {
      const revoked = await revoke(user);
      confirmation.close();
      return revoked;
    });
  }

  return (
    <li className="flex flex-wrap gap-3 items-center p-4 bg-white rounded-lg border border-gray-200">
      <div className="min-w-0 grow">
        <p className="font-medium text-gray-800 wrap-break-word">
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
        disabled={isSelf}
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
 * Lists everyone with access, each with what their role allows.
 *
 * The reader's own row is shown, but its role and access cannot be changed
 * from it, so a slip cannot lock the reader out. Another admin can change them.
 * The server refuses the change too.
 */
const AccessList: FC<{ users: UserRecord[] }> = ({ users }) => (
  <ul className="flex flex-col gap-2">
    {users.map((user) => (
      <Entry key={user.email} user={user} />
    ))}
  </ul>
);

export default AccessList;
