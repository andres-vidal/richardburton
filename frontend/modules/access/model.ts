import type { UserRole } from "modules/users";

/** An offer of a role to an address, and whether it has been taken up. */
type Invitation = {
  id: number;
  email: string;
  role: UserRole;
  acceptedAt: string | null;
  insertedAt: string;
};

export type { Invitation };
