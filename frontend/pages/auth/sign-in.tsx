import { GetServerSideProps, NextPage } from "next";

import Layout from "components/Layout";
import SignInButton from "components/SignInButton";

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  // Route sign-in errors (e.g. OAuthCallback) to the shared error page, so all
  // auth errors follow the same pattern — see pages/auth/error.
  if (typeof query.error === "string") {
    return {
      redirect: {
        destination: `/auth/error?error=${encodeURIComponent(query.error)}`,
        permanent: false,
      },
    };
  }

  const next = typeof query.callbackUrl === "string" ? query.callbackUrl : "/";
  return { props: { next } };
};

// The button goes straight to Google; after auth we land on the session bridge
// (which sets the rb-session cookie) and then on the destination.
const SignIn: NextPage<{ next: string }> = ({ next }) => (
  <Layout
    title="Sign in"
    content={
      <div className="flex items-center justify-center w-full py-32">
        <section className="flex flex-col justify-between text-center rounded shadow p-7 w-96 aspect-square">
          <h1 className="text-2xl">Sign in</h1>
          <p className="text-lg">
            Sign in with your Google account to access the platform.
          </p>
          <div className="flex justify-center">
            <SignInButton
              callbackUrl={`/api/session?next=${encodeURIComponent(next)}`}
            />
          </div>
        </section>
      </div>
    }
  />
);

export default SignIn;
