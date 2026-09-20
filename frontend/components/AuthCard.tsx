import { useTranslations } from "next-intl";
import { FC, ReactNode } from "react";

/**
 * A square panel centred on an otherwise empty page: a title, what happened,
 * and the one thing to do about it.
 *
 * The card is named rather than written out: it is given the name its copy goes
 * by, and reads the title and the body from there. Which of the two parts a
 * body has is the message's to say — one with nothing to suggest names no
 * suggestion — and how each part reads is the card's.
 */
const AuthCard: FC<{
  /** Names the card's copy in the catalogue, whole: `auth.pending`. */
  copy: string;
  /** What to do next, at the foot of the card. */
  children?: ReactNode;
}> = ({ copy, children }) => {
  const t = useTranslations(copy);

  return (
    <div className="flex justify-center items-center py-32 w-full">
      <section className="flex flex-col justify-between p-7 w-96 text-center rounded shadow aspect-square">
        <h1 className="text-2xl">{t("title")}</h1>
        <div className="space-y-4">
          {t.rich("body", {
            message: (chunks) => <p className="text-lg">{chunks}</p>,
            suggestion: (chunks) => <p className="text-sm">{chunks}</p>,
          })}
        </div>
        <div className="mx-auto">{children}</div>
      </section>
    </div>
  );
};

export default AuthCard;
