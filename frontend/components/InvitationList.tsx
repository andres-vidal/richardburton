"use client";

import type { Invitation } from "modules/access/model";
import { cancelInvitation, resendInvitation } from "modules/access/remote";
import { useFormatDate } from "modules/dates";
import { useTranslations } from "next-intl";
import { FC } from "react";
import { useMutation } from "utils/useMutation";
import Button from "./Button";

/**
 * One invitation's row: the address, the role and when it was offered. A
 * waiting invitation has buttons to send its mail again and to withdraw it,
 * both disabled while either runs. A taken-up one says when it was taken up.
 */
const Entry: FC<{ invitation: Invitation }> = ({ invitation }) => {
  const t = useTranslations("admin");
  const formatDate = useFormatDate();
  const { pending: working, run } = useMutation();
  const pending = invitation.acceptedAt === null;

  function resend() {
    run(() => resendInvitation(invitation.id));
  }

  function withdraw() {
    run(() => cancelInvitation(invitation.id));
  }

  return (
    <li
      data-pending={pending}
      className="flex flex-wrap gap-3 items-center p-4 rounded-lg border data-[pending=true]:bg-white data-[pending=true]:border-gray-200 data-[pending=false]:bg-gray-50 data-[pending=false]:border-gray-100"
    >
      <div className="min-w-0 grow">
        <p className="font-medium text-gray-800 wrap-break-words">
          {invitation.email}
        </p>
        <p className="text-xs text-gray-500">
          {t("invitedAs", {
            role: invitation.role,
            date: formatDate(invitation.insertedAt),
          })}
          {invitation.acceptedAt &&
            t("takenUpOn", { date: formatDate(invitation.acceptedAt) })}
        </p>
      </div>

      {pending ? (
        <>
          <span className="px-2 py-0.5 text-xs font-medium text-amber-800 bg-amber-100 rounded-full">
            {t("waiting")}
          </span>
          <Button
            label={t("sendAgain")}
            variant="outline"
            width="fit"
            size="small"
            loading={working}
            onClick={resend}
          />
          <Button
            label={t("withdraw")}
            variant="outline"
            width="fit"
            size="small"
            disabled={working}
            onClick={withdraw}
          />
        </>
      ) : (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full text-emerald-700 bg-emerald-100">
          {t("takenUp")}
        </span>
      )}
    </li>
  );
};

/**
 * Lists the invitations, waiting and taken up, or says that there are none.
 * Only a waiting invitation can be sent again or withdrawn. A taken-up one stays
 * listed as the record of how someone came to have their role.
 */
const InvitationList: FC<{ invitations: Invitation[] }> = ({ invitations }) => {
  const t = useTranslations("admin");

  return invitations.length === 0 ? (
    <p className="text-sm text-gray-600">{t("noInvitations")}</p>
  ) : (
    <ul className="flex flex-col gap-2">
      {invitations.map((invitation) => (
        <Entry key={invitation.id} invitation={invitation} />
      ))}
    </ul>
  );
};

export default InvitationList;
