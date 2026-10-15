import { request } from "app";
import { notify } from "components/Notifications";
import { attempt, type Notice } from "modules/attempt";
import { ApiError } from "modules/http";
import type { UserRecord, UserRole } from "modules/users";

/**
 * What came of offering a role: `granted` to a user who already has an
 * account, `invited` by mail, or `unsent` when the invitation was stored but
 * its mail could not be sent.
 */
type InviteOutcome = "granted" | "invited" | "unsent";

/** Returns the code of a refusal, or undefined for any other failure. */
const codeOf = (error: unknown): string | undefined =>
  error instanceof ApiError ? error.code : undefined;

/**
 * Offers the role `role` to `email`, notifies the outcome, and returns whether
 * the offer succeeded.
 *
 * A user who already has an account is given the role. Anyone else is sent an
 * invitation. When the mail cannot be sent, the invitation is still stored and
 * can be accepted, and the notice says so, so the mail can be sent again.
 */
function invite(email: string, role: UserRole): Promise<boolean> {
  return attempt(
    async () => {
      const { data } = await request((http) =>
        http.post<{ outcome: InviteOutcome }>("invitations", { email, role }),
      );

      const reports = {
        granted: {
          message: "notify.accessGranted",
          detail: "notify.accessGrantedDetail",
          values: { email, role },
          level: "success",
        },
        invited: {
          message: "notify.invitationSent",
          detail: "notify.invitationSentDetail",
          values: { email, role },
          level: "success",
        },
        unsent: {
          message: "notify.invitationUnsent",
          detail: "notify.invitationUnsentDetail",
          values: { email },
          level: "warning",
        },
      } satisfies Record<InviteOutcome, Notice>;

      notify(reports[data.outcome]);
    },
    (error) => ({
      message: "notify.inviteFailed",
      detail:
        codeOf(error) === "pending"
          ? "notify.invitePendingDetail"
          : codeOf(error) === "self"
            ? "notify.inviteSelfDetail"
            : "notify.inviteAddressDetail",
      values: { email },
      level: "warning",
    }),
  );
}

/** Gives `user` the role `role`, and returns whether that succeeded. */
function setRole(user: UserRecord, role: UserRole): Promise<boolean> {
  return attempt(
    async () => {
      await request((http) => http.patch(`users/${user.id}`, { role }));

      notify({
        message: "notify.roleChanged",
        detail: "notify.accessGrantedDetail",
        values: { email: user.email, role },
        level: "success",
      });
    },
    (error) => ({
      message: "notify.roleChangeFailed",
      ...refusal(error),
      level: "warning",
    }),
  );
}

/**
 * Revokes `user`'s access and ends their sessions, and returns whether that
 * succeeded.
 */
function revoke(user: UserRecord): Promise<boolean> {
  return attempt(
    async () => {
      await request((http) => http.delete(`users/${user.id}`));

      notify({
        message: "notify.accessRevoked",
        detail: "notify.accessRevokedDetail",
        values: { email: user.email },
        level: "success",
      });
    },
    (error) => ({
      message: "notify.revokeFailed",
      ...refusal(error),
      level: "warning",
    }),
  );
}

/** Withdraws an invitation nobody has accepted, and returns whether it did. */
function cancelInvitation(id: number): Promise<boolean> {
  return attempt(
    async () => {
      await request((http) => http.delete(`invitations/${id}`));
      notify({ message: "notify.invitationWithdrawn", level: "success" });
    },
    {
      message: "notify.withdrawFailed",
      detail: "notify.withdrawFailedDetail",
      level: "warning",
    },
  );
}

/** Sends a pending invitation's mail again, and returns whether it did. */
function resendInvitation(id: number): Promise<boolean> {
  return attempt(
    async () => {
      await request((http) => http.post(`invitations/${id}/resend`));
      notify({ message: "notify.invitationResent", level: "success" });
    },
    {
      message: "notify.resendFailed",
      detail: "notify.resendFailedDetail",
      level: "warning",
    },
  );
}

// Returns the detail line for a refused role change or revoke. The server
// refuses a change to one's own access ("self") and the removal of the last
// admin ("last_admin"); any other failure changed nothing.
function refusal(error: unknown): { detail: string } {
  switch (codeOf(error)) {
    case "self":
      return { detail: "notify.refusalSelf" };
    case "last_admin":
      return { detail: "notify.refusalLastAdmin" };
    default:
      return { detail: "notify.nothingChanged" };
  }
}

export { cancelInvitation, invite, resendInvitation, revoke, setRole };
