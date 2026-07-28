"use client";

import { invite } from "modules/access/remote";
import type { UserRole } from "modules/users";
import { useRouter } from "next/navigation";
import { FC, SubmitEvent, useState } from "react";
import Button from "./Button";
import RoleMenu from "./RoleMenu";
import TextInput from "./TextInput";

/**
 * Offer a role to an address.
 *
 * Any address: the identity provider mints an account only on a first sign-in,
 * so there is nobody to grant to beforehand and the offer waits on the address
 * instead. Someone already here is simply given the role — the form does not
 * need to know which, and says which happened afterwards.
 */
const InviteForm: FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("contributor");
  const [inviting, setInviting] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviting(true);
    const invited = await invite(email.trim(), role);
    setInviting(false);

    if (invited) {
      setEmail("");
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap gap-3 items-end p-4 bg-white rounded-lg border border-gray-200"
    >
      <label className="flex flex-col gap-1 text-sm min-w-64 grow">
        <span className="text-gray-500">Email address</span>
        <TextInput
          bordered
          type="email"
          required
          value={email}
          onChange={setEmail}
          placeholder="someone@example.com"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">Role</span>
        <RoleMenu
          // Named apart from the per-person menus below, which are also
          // "role": on a page full of them, "Role" alone says nothing.
          label="Role to invite as"
          value={role}
          onChange={setRole}
        />
      </div>

      <Button
        label="Invite"
        type="submit"
        width="fit"
        size="medium"
        loading={inviting}
        disabled={inviting || email.trim() === ""}
      />
    </form>
  );
};

export default InviteForm;
