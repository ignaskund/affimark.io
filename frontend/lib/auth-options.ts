/**
 * NextAuth configuration — extracted from the route file so it can be imported
 * by lib/auth.ts without triggering Next.js 15's route-handler type validator,
 * which rejects any non-HTTP-method named exports from route files.
 */

import type { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getOrCreateSupabaseUser(
  email: string,
  name: string
): Promise<string | null> {
  try {
    const { data: existingUsers, error: listError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error("[NextAuth] Error listing users:", listError);
      return null;
    }

    const existingUser = existingUsers.users.find((u) => u.email === email);

    if (existingUser) {
      console.log("[NextAuth] Found existing Supabase user:", existingUser.id);
      return existingUser.id;
    }

    const randomPassword = crypto.randomUUID() + crypto.randomUUID();

    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: randomPassword,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          provider: "google",
        },
      });

    if (createError) {
      console.error("[NextAuth] Error creating Supabase user:", createError);
      return null;
    }

    console.log("[NextAuth] Created new Supabase user:", newUser.user.id);
    return newUser.user.id;
  } catch (err) {
    console.error("[NextAuth] Error in getOrCreateSupabaseUser:", err);
    return null;
  }
}

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        isVerified: { label: "Is Verified", type: "text" },
        userId: { label: "User ID", type: "text" },
        userName: { label: "User Name", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          console.log("[NextAuth] Missing email");
          return null;
        }

        try {
          // Handle post-verification auto-sign-in (userId passed from verify-otp)
          if (credentials.isVerified === "true" && credentials.userId) {
            console.log(
              "[NextAuth] Post-verification sign-in for:",
              credentials.email,
              "userId:",
              credentials.userId
            );
            return {
              id: credentials.userId,
              email: credentials.email,
              name:
                credentials.userName ||
                credentials.email.split("@")[0],
            };
          }

          if (!credentials.password) {
            console.log(
              "[NextAuth] Missing password for standard sign-in"
            );
            return null;
          }

          const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          });

          if (error) {
            console.log("[NextAuth] Supabase auth error:", error.message);
            return null;
          }

          if (!data.user) {
            console.log("[NextAuth] No user returned from Supabase");
            return null;
          }

          console.log("[NextAuth] User authenticated:", data.user.id);
          return {
            id: data.user.id,
            email: data.user.email,
            name:
              data.user.user_metadata?.full_name ||
              data.user.email?.split("@")[0],
          };
        } catch (error) {
          console.log("[NextAuth] Unexpected error:", error);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        try {
          console.log("[NextAuth] Google sign-in for:", user.email);

          const supabaseUserId = await getOrCreateSupabaseUser(
            user.email,
            user.name || user.email.split("@")[0]
          );

          if (!supabaseUserId) {
            console.error(
              "[NextAuth] Failed to get/create Supabase user"
            );
            return true;
          }

          user.id = supabaseUserId;

          const { data: existingProfile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("id", supabaseUserId)
            .single();

          if (!existingProfile) {
            console.log(
              "[NextAuth] Creating profile for user:",
              supabaseUserId
            );
            const { error: profileError } = await supabaseAdmin
              .from("profiles")
              .insert({
                id: supabaseUserId,
                email: user.email,
                full_name:
                  user.name || user.email.split("@")[0],
                user_type: "creator",
                onboarding_completed: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });

            if (profileError) {
              console.error(
                "[NextAuth] Failed to create profile:",
                profileError
              );
            } else {
              console.log("[NextAuth] Profile created successfully");
            }
          } else {
            console.log(
              "[NextAuth] Profile already exists for:",
              supabaseUserId
            );
          }
        } catch (err) {
          console.error("[NextAuth] Error in signIn callback:", err);
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
};
