import AuthCard from "components/AuthCard";
import DevSignInButton from "components/DevSignInButton";
import Layout from "components/Layout";
import SignInButton from "components/SignInButton";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/** Returns the page's title. */
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("signIn.title") };
}

/**
 * The sign-in page. It offers Google sign-in and, in development, the buttons
 * that sign in as each role without Google.
 */
export default function SignInPage() {
  return (
    <Layout
      content={
        <AuthCard copy="auth.signIn">
          <div className="flex flex-col gap-3 items-center">
            <SignInButton />
            {process.env.NODE_ENV === "development" && <DevSignInButton />}
          </div>
        </AuthCard>
      }
    />
  );
}
