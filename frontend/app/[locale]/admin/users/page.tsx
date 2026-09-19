import AccessList from "components/AccessList";
import Breadcrumb from "components/Breadcrumb";
import InvitationList from "components/InvitationList";
import InviteForm from "components/InviteForm";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import SectionHeading from "components/SectionHeading";
import { User } from "modules/users";
import { redirect } from "i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getSession } from "app/session";
import { readInvitations, readUsers } from "./read";

// The admin layout admits any contributor, since the rest of it is theirs.
// Deciding who has access is not, so this page asks the narrower question again.
export default async function AccessPage() {
  const t = await getTranslations("admin");

  const crumbs = [
    { label: t("home"), href: "/" },
    { label: t("admin"), href: "/admin" },
    { label: t("accessTitle") },
  ];

  if (!User.canManageAccess(await getSession())) {
    redirect({ href: "/admin", locale: await getLocale() });
  }

  const [users, invitations] = await Promise.all([
    readUsers(),
    readInvitations(),
  ]);

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={crumbs} />
          <PageHeader title={t("accessTitle")} description={t("accessPage")} />
        </>
      }
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
