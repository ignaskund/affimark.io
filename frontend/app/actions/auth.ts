'use server'

import { signIn, signOut } from "@/lib/auth"

// This is for Google OAuth or Magic Link (not used currently)
export async function handleSignIn() {
	await signIn("google", { redirectTo: "/dashboard" })
}

export async function handleSignOut() {
	await signOut({ redirectTo: "/" })
} 