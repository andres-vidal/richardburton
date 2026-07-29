import AuthCard from "components/AuthCard";
import Layout from "components/Layout";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Access pending" };

/**
 * Where someone lands when the sign-in worked and there is nothing yet to do
 * with it.
 *
 * They were invited, so an account exists, but it holds a reader's role, which
 * carries nothing they could not already do signed out. "Access denied" would
 * be twice wrong: they were not denied, and there is something they can do
 * about it, which is ask.
 *
 * It says nothing about who they are, because it cannot: the session cookie is
 * relayed only once the gate passes, so at this point there is no session to
 * read.
 */
export default function AccessPendingPage() {
  return (
    <Layout
      content={
        <AuthCard
          title="Your account is ready"
          action={
            <Link href="/" className="anchor">
              Browse the database
            </Link>
          }
        >
          <p className="text-lg">
            Your role is Reader, which carries nothing to do here — the database
            is open to everyone, signed in or not.
          </p>
          <p className="text-sm">
            An administrator can give you a role that adds and corrects
            publications. Once they do, sign in again.
          </p>
        </AuthCard>
      }
    />
  );
}
