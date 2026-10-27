"use client";

import type { Language } from "modules/publication/model";
import { canTranslate, translateAll } from "modules/translator";
import { useTranslations } from "next-intl";
import { FC, useEffect, useState } from "react";
import Button from "./Button";
import ConfirmationModal from "./ConfirmationModal";
import { useModal } from "./Modal";

/**
 * A button labelled `label` that drafts text in `to` from `texts`, which are
 * in `from`, with the browser's built-in Translator API (see
 * `modules/translator`). The draft is made on the reader's computer, costs
 * nothing, and sends no text to a server.
 *
 * It renders nothing in a browser that cannot translate from `from` to `to`,
 * and nothing until that is known. It is disabled while every one of `texts`
 * is blank. A press translates each of `texts` and passes the translations,
 * in the same order, to `onDrafted`.
 *
 * With `replacing`, a press first asks, in a `ConfirmationModal` with that
 * title, message and confirm label, since the draft takes the place of text
 * already written. Cancelling the question drafts nothing.
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
  replacing?: { title: string; message: string; confirmLabel: string };
  onDrafted: (translations: string[]) => void;
}> = ({ label, from, to, texts, replacing, onDrafted }) => {
  const t = useTranslations("draft");
  const confirmation = useModal();
  const [available, setAvailable] = useState(false);
  const [running, setRunning] = useState(false);
  // The share of the model downloaded, from 0 to 1, or null while nothing has
  // been downloaded in this draft.
  const [loaded, setLoaded] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;

    canTranslate(from, to).then((can) => {
      if (current) setAvailable(can);
    });

    return () => {
      current = false;
    };
  }, [from, to]);

  async function draft() {
    confirmation.close();
    setFailed(false);
    setLoaded(null);
    setRunning(true);

    try {
      onDrafted(await translateAll(texts, from, to, setLoaded));
    } catch {
      setFailed(true);
    } finally {
      setRunning(false);
    }
  }

  const shown = !running
    ? label
    : loaded !== null && loaded < 1
      ? t("downloading", { loaded })
      : t("drafting");

  return available ? (
    <div className="flex flex-col gap-1 items-end">
      <Button
        label={shown}
        variant="outline"
        width="fit"
        size="small"
        loading={running}
        disabled={texts.every((text) => text.trim() === "")}
        onClick={() => (replacing ? confirmation.open() : draft())}
      />
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
          confirmLabel={replacing.confirmLabel}
          onConfirm={draft}
          onCancel={confirmation.close}
        />
      )}
    </div>
  ) : null;
};

export default DraftButton;
