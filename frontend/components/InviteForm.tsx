"use client";

import { invite } from "modules/access/remote";
import type { UserRole } from "modules/users";
import { useTranslations } from "next-intl";
import { FC, SubmitEvent, useState } from "react";
import { useMutation } from "utils/useMutation";
import Button from "./Button";
import RoleMenu from "./RoleMenu";
import TextInput from "./TextInput";

/**
 * A form that offers a role to an email address. Contributor is the role it
 * starts with. Submitting invites the address, and empties the field once the
 * invitation succeeds.
 *
 * Any address can be invited. The server gives the role at once to someone who
 * already has an account, and otherwise records an invitation that their first
 * sign-in takes up. The notification after it says which happened.
 */
const InviteForm: FC = () => {
  const t = useTranslations("access");
  const admin = useTranslations("admin");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("contributor");
  const { pending: inviting, run } = useMutation();

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      const invited = await invite(email.trim(), role);
      if (invited) setEmail("");
      return invited;
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap gap-3 items-end p-4 bg-white rounded-lg border border-gray-200"
    >
      <label className="flex flex-col gap-1 text-sm min-w-64 grow">
        <span className="text-gray-500">{admin("emailAddress")}</span>
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
        <span className="text-gray-500">{admin("role")}</span>
        <RoleMenu label={t("roleToInvite")} value={role} onChange={setRole} />
      </div>

      <Button
        label={t("invite")}
        type="submit"
        width="fit"
        size="field"
        loading={inviting}
        disabled={email.trim() === ""}
      />
    </form>
  );
};

export default InviteForm;
