import AccessList from "components/AccessList";
import AdminPage from "components/AdminPage";
import InvitationList from "components/InvitationList";
import InviteForm from "components/InviteForm";
import SectionHeading from "components/SectionHeading";
import { getTranslations } from "next-intl/server";

import { admitAdmins } from "../guard";
import { readInvitations, readUsers } from "./read";

/**
 * Lists the people who have access and the invitations sent, with a form to
 * invite someone. `admitAdmins` redirects anyone who is not an admin to the
 * admin index.
 */
export default async function AccessPage() {
  await admitAdmins();

  const [t, users, invitations] = await Promise.all([
    getTranslations("admin"),
    readUsers(),
    readInvitations(),
  ]);

  return (
    <AdminPage
      title={t("accessTitle")}
      description={t("accessPage")}
      measure="aligned"
      content={
        <div className="space-y-8">
          <section className="space-y-3">
            <SectionHeading>{t("inviteSomeone")}</SectionHeading>
            <InviteForm />
          </section>

          <section className="space-y-3">
            <SectionHeading>{t("people")}</SectionHeading>
            <AccessList users={users} />
          </section>

          <section className="space-y-3">
            <SectionHeading>{t("invitations")}</SectionHeading>
            <InvitationList invitations={invitations} />
          </section>
        </div>
      }
    />
  );
}
