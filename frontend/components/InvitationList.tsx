"use client";

import type { Invitation } from "modules/access/model";
import { cancelInvitation, resendInvitation } from "modules/access/remote";
import { useFormatDate } from "modules/dates";
import { useRouter } from "i18n/navigation";
import { useTranslations } from "next-intl";
import { FC, useState } from "react";
import Button from "./Button";

const Entry: FC<{ invitation: Invitation }> = ({ invitation }) => {
  const t = useTranslations("admin");
  const formatDate = useFormatDate();
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const pending = invitation.acceptedAt === null;

  // Sending the mail again leaves the invitation exactly as it was, so the
  // list has nothing to re-read; withdrawing takes the row away.
  async function resend() {
    setWorking(true);
    await resendInvitation(invitation.id);
    setWorking(false);
  }

  async function withdraw() {
    setWorking(true);
    const done = await cancelInvitation(invitation.id);
    setWorking(false);
    if (done) router.refresh();
  }

  return (
    <li
      data-pending={pending}
      className="flex flex-wrap gap-3 items-center p-4 rounded-lg border group data-[pending=true]:bg-white data-[pending=true]:border-gray-200 data-[pending=false]:bg-gray-50 data-[pending=false]:border-gray-100"
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
            disabled={working}
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
 * The invitations, waiting and taken up.
 *
 * A taken-up one stays listed: it is the record of how someone came to have
 * what they have, and who offered it. Only a waiting one can be withdrawn or
 * sent again — there is nothing left to chase once it has been redeemed.
 */
const InvitationList: FC<{ invitations: Invitation[] }> = ({ invitations }) => {
  const t = useTranslations("admin");

  return (
    <div>
      {invitations.length === 0 ? (
        <p className="text-sm text-gray-600">{t("noInvitations")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {invitations.map((invitation) => (
            <Entry key={invitation.id} invitation={invitation} />
          ))}
        </ul>
      )}
    </div>
  );
};

export default InvitationList;
