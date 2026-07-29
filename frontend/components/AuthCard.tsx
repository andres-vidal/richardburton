import { FC, ReactNode } from "react";

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
