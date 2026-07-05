import axios from "axios";
import NextAuth, { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import HTTP from "modules/http";
import { User } from "modules/users";

declare module "next-auth/jwt" {
  interface JWT {
    idToken: string | undefined;
  }
}

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

const http = HTTP.client({ baseURL: process.env.NEXT_INTERNAL_API_URL });

if (!clientId) throw "Must provide a client id for authentication.";
if (!clientSecret) throw "Must provide a client secret for authentication.";

const authOptions: AuthOptions = {
  providers: [GoogleProvider({ clientId, clientSecret })],
  pages: {
    signIn: "/auth/sign-in",
    error: "/auth/error",
  },
  callbacks: {
    async signIn(params) {
      let user: User | null = null;
      try {
        const { email } = params.user;
        const { data } = await http.post<User>(
          "/users",
          { email },
          { headers: { Authorization: `Bearer ${params.account?.id_token}` } },
        );
        user = data;
      } catch (e) {
        if (axios.isAxiosError(e) && e.response && e.response.status === 409) {
          user = e.response.data as User;
        } else {
          console.error(e);
        }
      }

      return user ? User.isAdmin(user.role) : false;
    },
    async jwt({ token, account }) {
      if (account) {
        token.idToken = account.id_token;
      }
      return token;
    },
  },
};

export default NextAuth(authOptions);
export { authOptions };
