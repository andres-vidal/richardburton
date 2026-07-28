import AccessList from "components/AccessList";
import Breadcrumb from "components/Breadcrumb";
import InvitationList from "components/InvitationList";
import InviteForm from "components/InviteForm";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import SectionHeading from "components/SectionHeading";
import { User } from "modules/users";
import { redirect } from "next/navigation";

import { getSession } from "../../session";
import { readInvitations, readUsers } from "./read";

const BREADCRUMB_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Admin", href: "/admin" },
  { label: "Access" },
];

// The admin layout admits any contributor, since the rest of it is theirs.
// Deciding who has access is not, so this page asks the narrower question again.
export default async function AccessPage() {
  if (!User.administers(await getSession())) redirect("/admin");

  const [users, invitations] = await Promise.all([
    readUsers(),
    readInvitations(),
  ]);

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={BREADCRUMB_ITEMS} />
          <PageHeader
            title="Access"
            description="Who can work on the catalogue, and what they may do."
          />
        </>
      }
      measure="aligned"
      content={
        <div className="space-y-8">
          <section className="space-y-3">
            <SectionHeading>Invite someone</SectionHeading>
            <InviteForm />
          </section>

          <section className="space-y-3">
            <SectionHeading>People</SectionHeading>
            <AccessList users={users} />
          </section>

          <section className="space-y-3">
            <SectionHeading>Invitations</SectionHeading>
            <InvitationList invitations={invitations} />
          </section>
        </div>
      }
    />
  );
}
