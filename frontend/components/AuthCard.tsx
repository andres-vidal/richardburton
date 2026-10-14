import { useTranslations } from "next-intl";
import { FC, ReactNode } from "react";

/**
 * Renders a square panel centred on the page: a title, what happened, and the
 * one thing to do about it, `children`, at the foot.
 *
 * It reads the `title` and `body` messages under the `copy` namespace. The
 * body is rich text whose `<message>` part renders as a paragraph and whose
 * optional `<suggestion>` part renders as a smaller one.
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
