import { notify } from "components/Notifications";
import type { UserRecord } from "modules/users";
import { httpError, networkError, stubHttp } from "test/http";

import {
  cancelInvitation,
  invite,
  resendInvitation,
  revoke,
  setRole,
} from "./remote";

vi.mock("components/Notifications", () => ({ notify: vi.fn() }));

const mockNotify = vi.mocked(notify);

let http: ReturnType<typeof stubHttp>;

const CURATOR: UserRecord = {
  id: 2,
  email: "curator@rb.test",
  role: "contributor",
  insertedAt: "2026-03-11T10:00:00",
};

beforeEach(() => {
  vi.clearAllMocks();
  http = stubHttp();
});

afterEach(() => vi.restoreAllMocks());

describe("invite", () => {
  test("reports each outcome the server gives", async () => {
    http.post.mockResolvedValue({ data: { outcome: "unsent" } });

    const ok = await invite("someone@rb.test", "contributor");

    expect(ok).toBe(true);
    expect(http.post).toHaveBeenCalledWith("invitations", {
      email: "someone@rb.test",
      role: "contributor",
    });
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "notify.invitationUnsent",
        level: "warning",
      }),
    );
  });

  test.each([
    ["pending", "notify.invitePendingDetail"],
    ["self", "notify.inviteSelfDetail"],
    ["invalid", "notify.inviteAddressDetail"],
  ])("explains a refusal with the code %s", async (code, detail) => {
    http.post.mockRejectedValue(httpError(409, { error: code }));

    const ok = await invite("someone@rb.test", "admin");

    expect(ok).toBe(false);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ message: "notify.inviteFailed", detail }),
    );
  });
});

describe("setRole", () => {
  test("PATCHes the role and returns true", async () => {
    http.patch.mockResolvedValue({ data: { ...CURATOR, role: "admin" } });

    const ok = await setRole(CURATOR, "admin");

    expect(ok).toBe(true);
    expect(http.patch).toHaveBeenCalledWith("users/2", { role: "admin" });
  });

  test("explains the refusal to demote the last admin", async () => {
    http.patch.mockRejectedValue(httpError(409, { error: "last_admin" }));

    const ok = await setRole(CURATOR, "reader");

    expect(ok).toBe(false);
    expect(mockNotify).toHaveBeenCalledWith({
      message: "notify.roleChangeFailed",
      detail: "notify.refusalLastAdmin",
      level: "warning",
    });
  });

  test("says nothing changed when the role is missing", async () => {
    http.patch.mockRejectedValue(httpError(403, { error: "forbidden" }));

    const ok = await setRole(CURATOR, "reader");

    expect(ok).toBe(false);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ detail: "notify.nothingChanged" }),
    );
  });
});

describe("revoke", () => {
  test("explains the refusal to revoke one's own access", async () => {
    http.delete.mockRejectedValue(httpError(409, { error: "self" }));

    const ok = await revoke(CURATOR);

    expect(ok).toBe(false);
    expect(mockNotify).toHaveBeenCalledWith({
      message: "notify.revokeFailed",
      detail: "notify.refusalSelf",
      level: "warning",
    });
  });
});

describe("invitations", () => {
  test("withdrawing DELETEs the invitation", async () => {
    http.delete.mockResolvedValue({});

    expect(await cancelInvitation(4)).toBe(true);
    expect(http.delete).toHaveBeenCalledWith("invitations/4");
  });

  test("a failed resend is notified and returns false", async () => {
    http.post.mockRejectedValue(networkError());

    expect(await resendInvitation(4)).toBe(false);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ message: "notify.resendFailed" }),
    );
  });
});
