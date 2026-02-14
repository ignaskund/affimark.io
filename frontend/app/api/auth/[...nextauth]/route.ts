import NextAuth, { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Admin client for creating users and profiles (bypasses RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper to get or create Supabase user for OAuth providers
async function getOrCreateSupabaseUser(email: string, name: string): Promise<string | null> {
    try {
        // First, check if a Supabase Auth user exists by email
        const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

        if (listError) {
            console.error('[NextAuth] Error listing users:', listError);
            return null;
        }

        const existingUser = existingUsers.users.find(u => u.email === email);

        if (existingUser) {
            console.log('[NextAuth] Found existing Supabase user:', existingUser.id);
            return existingUser.id;
        }

        // Create a new Supabase Auth user for this OAuth user
        // Use a random password since they'll sign in via OAuth
        const randomPassword = crypto.randomUUID() + crypto.randomUUID();

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: randomPassword,
            email_confirm: true, // Auto-confirm since they verified via Google
            user_metadata: {
                full_name: name,
                provider: 'google',
            },
        });

        if (createError) {
            console.error('[NextAuth] Error creating Supabase user:', createError);
            return null;
        }

        console.log('[NextAuth] Created new Supabase user:', newUser.user.id);
        return newUser.user.id;
    } catch (err) {
        console.error('[NextAuth] Error in getOrCreateSupabaseUser:', err);
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
                    // Handle post-verification auto-sign-in (no password needed)
                    // User ID and name are passed directly from verify-otp endpoint
                    if (credentials.isVerified === 'true' && credentials.userId) {
                        console.log("[NextAuth] Post-verification sign-in for:", credentials.email, "userId:", credentials.userId);

                        // Trust the userId from verify-otp - no need to look up again
                        return {
                            id: credentials.userId,
                            email: credentials.email,
                            name: credentials.userName || credentials.email.split('@')[0],
                        };
                    }

                    // Standard password-based authentication
                    if (!credentials.password) {
                        console.log("[NextAuth] Missing password for standard sign-in");
                        return null;
                    }

                    // Authenticate with Supabase
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

                    // Return user object for NextAuth session
                    return {
                        id: data.user.id,
                        email: data.user.email,
                        name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0],
                    };
                } catch (error) {
                    console.log("[NextAuth] Unexpected error:", error);
                    return null;
                }
            }
        })
    ],
    pages: {
        signIn: '/sign-in',
        error: '/sign-in',
    },
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async signIn({ user, account }) {
            // For OAuth providers (Google), ensure user exists in Supabase Auth and has a profile
            if (account?.provider === 'google' && user.email) {
                try {
                    console.log('[NextAuth] Google sign-in for:', user.email);

                    // Get or create Supabase Auth user (returns Supabase UUID)
                    const supabaseUserId = await getOrCreateSupabaseUser(
                        user.email,
                        user.name || user.email.split('@')[0]
                    );

                    if (!supabaseUserId) {
                        console.error('[NextAuth] Failed to get/create Supabase user');
                        // Still allow sign-in but profile features won't work
                        return true;
                    }

                    // Update user.id to use Supabase UUID (will be used in jwt callback)
                    user.id = supabaseUserId;

                    // Now create profile if it doesn't exist
                    const { data: existingProfile } = await supabaseAdmin
                        .from('profiles')
                        .select('id')
                        .eq('id', supabaseUserId)
                        .single();

                    if (!existingProfile) {
                        console.log('[NextAuth] Creating profile for user:', supabaseUserId);
                        const { error: profileError } = await supabaseAdmin
                            .from('profiles')
                            .insert({
                                id: supabaseUserId,
                                email: user.email,
                                full_name: user.name || user.email.split('@')[0],
                                user_type: 'creator',
                                onboarding_completed: false,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            });

                        if (profileError) {
                            console.error('[NextAuth] Failed to create profile:', profileError);
                        } else {
                            console.log('[NextAuth] Profile created successfully');
                        }
                    } else {
                        console.log('[NextAuth] Profile already exists for:', supabaseUserId);
                    }
                } catch (err) {
                    console.error('[NextAuth] Error in signIn callback:', err);
                }
            }
            return true; // Allow sign-in to proceed
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
            // Allows relative callback URLs
            if (url.startsWith("/")) return `${baseUrl}${url}`;
            // Allows callback URLs on the same origin
            if (new URL(url).origin === baseUrl) return url;
            return baseUrl;
        }
    },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
