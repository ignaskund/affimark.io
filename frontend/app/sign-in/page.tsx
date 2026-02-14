import { Suspense } from 'react';
import SignInForm from '@/components/auth/SignInForm';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Sign In | Affimark',
    description: 'Sign in to your Affimark account',
};

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function SignInPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const session = await auth();
    const params = await searchParams;

    if (session?.user) {
        const callbackUrl = typeof params?.callbackUrl === 'string' ? params.callbackUrl : '/dashboard';
        redirect(callbackUrl);
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-950">
            <div className="w-full max-w-md space-y-8">
                <Suspense fallback={<div className="text-white text-center">Loading...</div>}>
                    <SignInForm />
                </Suspense>
            </div>
        </div>
    );
}
