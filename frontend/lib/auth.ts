import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import pg from "pg";

let _auth: ReturnType<typeof betterAuth> | null = null;

function getAuth() {
  if (_auth) return _auth;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId)
    throw new Error("Must provide GOOGLE_CLIENT_ID for authentication.");
  if (!clientSecret)
    throw new Error("Must provide GOOGLE_CLIENT_SECRET for authentication.");

  _auth = betterAuth({
    database: new pg.Pool({
      connectionString: process.env.DATABASE_URL!,
    }),
    basePath: "/api/auth",
    secret: process.env.BETTER_AUTH_SECRET,
    socialProviders: {
      google: {
        clientId,
        clientSecret,
      },
    },
    user: {
      modelName: "ba_user",
    },
    session: {
      modelName: "ba_session",
    },
    account: {
      modelName: "ba_account",
    },
    verification: {
      modelName: "ba_verification",
    },
    plugins: [
      jwt({
        jwt: {
          definePayload: async ({ user }) => {
            return {
              id: user.id,
              email: user.email,
            };
          },
          expirationTime: "1h",
        },
        jwks: {
          keyPairConfig: {
            alg: "RS256",
          },
        },
        schema: {
          jwks: {
            modelName: "ba_jwks",
          },
        },
      }),
    ],
    callbacks: {
      async signIn({ user }: { user: { id: string; email: string } }) {
        // Only allow admin users to sign in
        // Query the backend's users table directly (shared database)
        const pool = new pg.Pool({
          connectionString: process.env.DATABASE_URL!,
        });
        try {
          const result = await pool.query(
            "SELECT role FROM users WHERE email = $1",
            [user.email],
          );
          if (result.rows.length === 0) {
            // User doesn't exist in backend table yet — create them
            await pool.query(
              "INSERT INTO users (email, role, subject_id, inserted_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) ON CONFLICT DO NOTHING",
              [user.email, "reader", user.id],
            );
            return false; // New users are readers, not admins
          }
          return result.rows[0].role === "admin";
        } catch (error) {
          console.error("Error checking user role:", error);
          return false;
        } finally {
          await pool.end();
        }
      },
    },
  });

  return _auth;
}

// Proxy object that lazily initializes auth on first access
export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
  get(_target, prop) {
    return (getAuth() as Record<string | symbol, unknown>)[prop];
  },
});
