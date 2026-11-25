"use client";

import type { Language } from "modules/publication/model";
import { canTranslate, translateAll } from "modules/translator";
import { useTranslations } from "next-intl";
import { FC, useEffect, useRef, useState } from "react";
import Button from "./Button";
import ConfirmationModal from "./ConfirmationModal";
import InfoHint from "./InfoHint";
import { useModal } from "./Modal";

/**
 * A button labelled `label` that drafts text in `to` from `texts`, which are
 * in `from`, with the browser's built-in Translator API (see
 * `modules/translator`). The draft is made on the reader's computer, costs
 * nothing, and sends no text to a server.
 *
 * It renders nothing until the browser has said whether it can translate
 * from `from` to `to`. In a browser that cannot, the button is disabled, and
 * an `InfoHint` beside it says which browsers can. It is also disabled while
 * every one of `texts` is blank. A press translates each of `texts` and passes the translations,
 * in the same order, to `onDrafted`.
 *
 * With `replacing`, a press first asks, in a `ConfirmationModal` with that
 * title and message and a Replace button, since the draft takes the place of
 * text already written. Cancelling the question drafts nothing.
 *
 * A draft can take a while, and text can be written in the meantime. When a
 * press did not ask, and `replacing` is set by the time the translations are
 * ready, the same question is asked then. Replace passes the translations to
 * `onDrafted`, and Cancel discards them.
 *
 * While the browser downloads the translation model, the button shows how
 * much of it has arrived, and while it translates, that it is drafting. When
 * the draft fails, a message under the button says so, and `onDrafted` is not
 * called.
 */
const DraftButton: FC<{
  label: string;
  from: Language;
  to: Language;
  texts: string[];
  replacing?: { title: string; message: string };
  onDrafted: (translations: string[]) => void;
}> = ({ label, from, to, texts, replacing, onDrafted }) => {
  const t = useTranslations("draft");
  const confirmation = useModal();
  // Whether the browser can translate the pair, or null until it has said.
  const [available, setAvailable] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  // The share of the model downloaded, from 0 to 1, or null while nothing has
  // been downloaded in this draft.
  const [loaded, setLoaded] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  // The translations that are ready but wait for the question to be answered,
  // or null when none wait.
  const [held, setHeld] = useState<string[] | null>(null);
  // Whether the last render had `replacing`, for a draft that finishes after
  // the render it started in.
  const replaces = useRef(Boolean(replacing));

  useEffect(() => {
    replaces.current = Boolean(replacing);
  });

  useEffect(() => {
    let current = true;

    canTranslate(from, to).then((can) => {
      if (current) setAvailable(can);
    });

    return () => {
      current = false;
    };
  }, [from, to]);

  // Translates `texts` and passes the translations on. `asked` says whether
  // the person already agreed to replace the text written. Without it, the
  // translations are held and the question is asked when text was written
  // while the draft ran.
  async function draft(asked: boolean) {
    confirmation.close();
    setFailed(false);
    setLoaded(null);
    setRunning(true);

    try {
      const translations = await translateAll(texts, from, to, setLoaded);

      if (replaces.current && !asked) {
        setHeld(translations);
        confirmation.open();
      } else {
        onDrafted(translations);
      }
    } catch {
      setFailed(true);
    } finally {
      setRunning(false);
    }
  }

  // Passes on the held translations, which the person agreed to.
  function replace() {
    confirmation.close();
    if (held) onDrafted(held);
    setHeld(null);
  }

  // Closes the question, and discards the held translations if there are any.
  function cancel() {
    confirmation.close();
    setHeld(null);
  }

  const shown = !running
    ? label
    : loaded !== null && loaded < 1
      ? t("downloading", { loaded })
      : t("drafting");

  return available === null ? null : (
    <div className="flex flex-col gap-1 items-end">
      <div className="flex gap-1.5 items-center">
        <Button
          label={shown}
          variant="outline"
          width="fit"
          size="small"
          loading={running}
          disabled={!available || texts.every((text) => text.trim() === "")}
          onClick={() => (replacing ? confirmation.open() : draft(false))}
        />
        {!available && (
          <InfoHint label={t("unavailableLabel")} message={t("unavailable")} />
        )}
      </div>
      {failed && (
        <p role="alert" className="text-xs text-red-700">
          {t("failed")}
        </p>
      )}
      {replacing && (
        <ConfirmationModal
          isOpen={confirmation.isOpen}
          title={replacing.title}
          message={replacing.message}
          confirmLabel={t("replace")}
          onConfirm={held ? replace : () => draft(true)}
          onCancel={cancel}
        />
      )}
    </div>
  );
};

export default DraftButton;
