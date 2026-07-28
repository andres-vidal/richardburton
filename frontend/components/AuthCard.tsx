import { FC, ReactNode } from "react";

/**
 * The card the auth pages are: a title, what happened, and the one thing to do
 * about it, in a square panel centred on an otherwise empty page.
 *
 * Signing in, being turned away and waiting for a role are the same moment seen
 * three ways, so they are one shape — a person meeting the second having just
 * seen the first should not have to work out that they are still in the same
 * place.
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
