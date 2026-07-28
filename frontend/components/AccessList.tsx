"use client";

import { revoke, setRole } from "modules/access/remote";
import { useSession } from "modules/session";
import { formatDate } from "modules/dates";
import {
  ROLE_DESCRIPTIONS,
  type UserRecord,
  type UserRole,
} from "modules/users";
import { useRouter } from "next/navigation";
import { FC, useState } from "react";
import Button from "./Button";
import ConfirmationModal from "./ConfirmationModal";
import { useModal } from "./Modal";
import RoleMenu from "./RoleMenu";

const Entry: FC<{ user: UserRecord; isSelf: boolean }> = ({ user, isSelf }) => {
  const router = useRouter();
  const confirmation = useModal();
  const [working, setWorking] = useState(false);

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
          {isSelf && <span className="ml-2 text-xs text-gray-500">(you)</span>}
        </p>
        <p className="text-xs text-gray-500">
          {ROLE_DESCRIPTIONS[user.role]} · joined {formatDate(user.insertedAt)}
        </p>
      </div>

      <RoleMenu
        value={user.role}
        label={`Role for ${user.email}`}
        disabled={working || isSelf}
        onChange={change}
      />

      <Button
        label="Revoke"
        variant="danger"
        width="fit"
        size="field"
        loading={working}
        disabled={working || isSelf}
        onClick={() => confirmation.open()}
      />

      <ConfirmationModal
        isOpen={confirmation.isOpen}
        title="Revoke this access?"
        message={`${user.email} will be signed out and will not be able to sign in again until they are invited back.`}
        confirmLabel="Revoke"
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
const AccessList: FC<{ users: UserRecord[] }> = ({ users }) => {
  const session = useSession();

  return (
    <ul className="flex flex-col gap-2">
      {users.map((user) => (
        <Entry
          key={user.email}
          user={user}
          isSelf={user.email === session?.email}
        />
      ))}
    </ul>
  );
};

export default AccessList;
