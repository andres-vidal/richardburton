import { get } from "app/api";
import type { Invitation } from "modules/access/model";
import type { UserRecord } from "modules/users";
import { cache } from "react";

export const readUsers = cache(() => get<UserRecord[]>("/users"));

export const readInvitations = cache(() => get<Invitation[]>("/invitations"));
