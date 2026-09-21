"use client";

import PeopleIcon from "assets/people.svg";
import { useOthersPresent, useWorkspaceId } from "modules/publication/presence";
import { addMember, show } from "modules/publication/workspace-remote";
import { useTranslations } from "next-intl";
import { FC, FormEvent, useCallback, useEffect, useState } from "react";
import Button from "./Button";
import { Modal } from "./Modal";
import SectionHeading from "./SectionHeading";
import Tooltip from "./Tooltip";

type Member = { id: number; email: string };

/** The first letter of an address, which is enough to tell two people apart. */
const initial = (email: string) => email.slice(0, 1).toUpperCase();

/**
 * Who is in this workspace, who is looking at it right now, and how to let
 * somebody else in.
 *
 * Membership is what the server keeps: it decides who may open the workspace at
 * all. Presence is what awareness carries: it is only true while someone has it
 * open, and is never written down.
 */
const WorkspaceShare: FC<{
  /** How someone is let in. Defaults to asking the server. */
  invite?: (id: number, email: string) => Promise<void>;
  /** How the members are read. Defaults to asking the server. */
  read?: (id: number) => Promise<{ members: Member[] }>;
}> = ({ invite = addMember, read = show }) => {
  const t = useTranslations("workspaces");
  const workspace = useWorkspaceId();
  const present = useOthersPresent();

  const [isOpen, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    if (workspace === undefined) return;

    read(workspace)
      .then(({ members: found }) => setMembers(found))
      .catch(() => setMembers([]));
  }, [workspace, read]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || workspace === undefined) return;

    setInviting(true);
    setFailed(false);
    try {
      await invite(workspace, email.trim());
      setEmail("");
      load();
    } catch {
      // The likeliest reason is nobody signed in under that address.
      setFailed(true);
    } finally {
      setInviting(false);
    }
  }

  return workspace === undefined ? null : (
    <>
      <Tooltip variant="info" message={t("shareHint")}>
        <Button
          label={t("share")}
          variant="outline"
          Icon={PeopleIcon}
          alignment="left"
          width="fit"
          onClick={() => setOpen(true)}
        />
      </Tooltip>

      {present.length > 0 && (
        <ul
          aria-label={t("hereNow")}
          className="flex items-center -space-x-1.5"
        >
          {present.map((person) => (
            <li key={person.clientId}>
              <Tooltip variant="info" message={person.email}>
                <span
                  aria-label={person.email}
                  className="flex justify-center items-center text-xs font-medium text-white rounded-full ring-2 ring-white size-6 bg-indigo-500"
                >
                  {initial(person.email)}
                </span>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={isOpen} onClose={() => setOpen(false)} label={t("share")}>
        <div className="flex flex-col gap-5 p-8 w-full">
          <h1 className="text-2xl font-normal">{t("shareHeading")}</h1>

          <form onSubmit={handleInvite} className="flex gap-2 items-end">
            <label className="flex flex-col gap-1 grow">
              <span className="text-sm text-gray-600">{t("inviteLabel")}</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("invitePlaceholder")}
                aria-label={t("inviteLabel")}
                className="py-2 px-3 w-full bg-white rounded border border-gray-300 transition-colors outline-none placeholder:text-sm focus:bg-gray-100 hover:bg-gray-100"
              />
            </label>
            <Button
              label={t("invite")}
              type="submit"
              variant="primary"
              width="fit"
              size="medium"
              loading={inviting}
              disabled={!email.trim() || inviting}
            />
          </form>

          {failed && (
            <p role="alert" className="text-sm text-red-700">
              {t("inviteFailed")}
            </p>
          )}

          <section className="space-y-2">
            <SectionHeading>{t("members")}</SectionHeading>
            {members.length === 0 ? (
              <p className="text-sm text-gray-600">{t("noMembers")}</p>
            ) : (
              <ul className="space-y-1 text-sm text-gray-700">
                {members.map((member) => (
                  <li key={member.id}>{member.email}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Modal>
    </>
  );
};

export default WorkspaceShare;
