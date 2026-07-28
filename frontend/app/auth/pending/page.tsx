import Layout from "components/Layout";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Access pending" };

/**
 * Where someone lands when the sign-in worked and there is nothing yet to do
 * with it.
 *
 * They were invited, so an account exists, but the role it carries does not
 * reach the catalogue — an invitation as a reader, or a role since taken back.
 * "Access denied" would be twice wrong: they were not denied, and there is
 * something they can do about it, which is ask.
 *
 * It says nothing about who they are, because it cannot: the session cookie is
 * relayed only once the gate passes, so at this point there is no session to
 * read.
 */
export default function AccessPendingPage() {
  return (
    <Layout
      content={
        <div className="flex justify-center items-center py-32 w-full">
          <div className="space-y-4 max-w-prose text-center">
            <h1 className="text-2xl font-normal">Your account is ready</h1>
            <p className="text-gray-700">
              You have an account here, but it does not reach the catalogue yet.
            </p>
            <p className="text-gray-700">
              An administrator can grant that. Once they do, sign in again and
              it will be waiting for you.
            </p>
            <p className="pt-2">
              <Link href="/" className="anchor">
                Browse the catalogue
              </Link>
            </p>
          </div>
        </div>
      }
    />
  );
}
