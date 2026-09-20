import { FC, ReactNode } from "react";

/**
 * The parts a card's body is written in, for `t.rich` to render the message
 * with: what happened, and what to do about it where there is anything.
 *
 * Which of the two a card has is the message's to say, and how each one reads
 * is the card's, which is why the message names them and this gives them their
 * type.
 */
const AUTH_CARD_BODY = {
  message: (chunks: ReactNode) => <p className="text-lg">{chunks}</p>,
  suggestion: (chunks: ReactNode) => <p className="text-sm">{chunks}</p>,
};

/**
 * A square panel centred on an otherwise empty page: a title, what happened,
 * and the one thing to do about it.
 */
const AuthCard: FC<{
  title: string;
  children: ReactNode;
  /** What to do next, at the foot of the card. */
  action?: ReactNode;
}> = ({ title, children, action }) => (
  <div className="flex justify-center items-center py-32 w-full">
    <section className="flex flex-col justify-between p-7 w-96 text-center rounded shadow aspect-square">
      <h1 className="text-2xl">{title}</h1>
      <div className="space-y-4">{children}</div>
      <div className="mx-auto">{action}</div>
    </section>
  </div>
);

export default AuthCard;
export { AUTH_CARD_BODY };
