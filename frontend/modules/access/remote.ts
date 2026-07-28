import { request } from "app";
import { notify } from "components/Notifications";
import { describeRole, type UserRecord, type UserRole } from "modules/users";

/** What happened to an offer of a role, which is not always the same thing. */
type InviteOutcome = "granted" | "invited" | "unsent";

/**
 * Why the server said no, as `request` leaves it: a 409 arrives as the bare
 * string "conflict", anything else as the response body.
 */
function errorOf(error: unknown): string | undefined {
  return typeof error === "string"
    ? error
    : (error as { error?: string } | undefined)?.error;
}

/**
 * Offer a role to an address.
 *
 * Three things can happen and each is reported: someone already here was given
 * the role, someone new has an invitation waiting, or the invitation stands but
 * could not be mailed — that last one still granted, still redeemable, and
 * worth saying out loud so it can be sent again.
 */
async function invite(email: string, role: UserRole): Promise<boolean> {
  try {
    const { data } = await request((http) =>
      http.post<{ outcome: InviteOutcome }>("invitations", { email, role }),
    );

    const reports = {
      granted: {
        message: "Access granted",
        detail: `${email} is now ${describeRole(role)}.`,
        level: "success",
      },
      invited: {
        message: "Invitation sent",
        detail: `${email} will be ${describeRole(role)} once they sign in.`,
        level: "success",
      },
      unsent: {
        message: "Access granted, but the invitation was not sent",
        detail: `${email} can sign in to take it up. Send the invitation again when mail is working.`,
        level: "warning",
      },
    } satisfies Record<InviteOutcome, Parameters<typeof notify>[0]>;

    notify(reports[data.outcome]);

    return true;
  } catch (error) {
    notify({
      message: "Could not invite",
      detail:
        errorOf(error) === "pending"
          ? `${email} already has an invitation waiting.`
          : errorOf(error) === "self"
            ? "Another admin has to change your own role for you."
            : `Check the address and try again.`,
      level: "warning",
    });
    return false;
  }
}

/** Change what someone may do. */
async function setRole(user: UserRecord, role: UserRole): Promise<boolean> {
  try {
    await request((http) => http.patch(`users/${user.id}`, { role }));

    notify({
      message: "Role changed",
      detail: `${user.email} is now ${describeRole(role)}.`,
      level: "success",
    });
    return true;
  } catch (error) {
    notify({
      message: "Could not change the role",
      ...refusal(error),
      level: "warning",
    });
    return false;
  }
}

/** Revoke someone's access, and the sessions signed in as them. */
async function revoke(user: UserRecord): Promise<boolean> {
  try {
    await request((http) => http.delete(`users/${user.id}`));

    notify({
      message: "Access revoked",
      detail: `${user.email} is signed out and can no longer sign in.`,
      level: "success",
    });
    return true;
  } catch (error) {
    notify({
      message: "Could not revoke access",
      ...refusal(error),
      level: "warning",
    });
    return false;
  }
}

/** Withdraw an invitation nobody has taken up. */
async function cancelInvitation(id: number): Promise<boolean> {
  try {
    await request((http) => http.delete(`invitations/${id}`));
    notify({ message: "Invitation withdrawn", level: "success" });
    return true;
  } catch {
    notify({
      message: "Could not withdraw the invitation",
      detail: "It may have been taken up already.",
      level: "warning",
    });
    return false;
  }
}

/** Send a pending invitation's mail again. */
async function resendInvitation(id: number): Promise<boolean> {
  try {
    await request((http) => http.post(`invitations/${id}/resend`));
    notify({ message: "Invitation sent again", level: "success" });
    return true;
  } catch {
    notify({
      message: "Could not send the invitation",
      detail: "Check that mail is working and try again.",
      level: "warning",
    });
    return false;
  }
}

// The two refusals worth explaining: both are the server protecting the
// platform from losing its last admin, or someone from locking themselves out.
function refusal(error: unknown): { detail: string } {
  switch (errorOf(error)) {
    case "self":
      return { detail: "Another admin has to do this one for you." };
    case "last_admin":
      return {
        detail:
          "This is the only admin left. Make someone else an admin first.",
      };
    default:
      return {
        detail: "Nothing changed. Check your connection and try again.",
      };
  }
}

export { cancelInvitation, invite, resendInvitation, revoke, setRole };
