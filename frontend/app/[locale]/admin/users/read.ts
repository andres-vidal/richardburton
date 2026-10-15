import { get } from "app/api";
import type { Invitation } from "modules/access/model";
import type { UserRecord } from "modules/users";

/** Reads every user who has an account, as the signed-in user. */
export async function readUsers(): Promise<UserRecord[]> {
  return get<UserRecord[]>("/users");
}

/** Reads every invitation sent, as the signed-in user. */
export async function readInvitations(): Promise<Invitation[]> {
  return get<Invitation[]>("/invitations");
}
