import { Suspense } from 'react';
import SignUpForm from '@/components/auth/SignUpForm';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Sign Up | Affimark',
    description: 'Create your Affimark account',
};

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function SignUpPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const session = await auth();
    if (session?.user) {
        const callbackUrl = typeof searchParams?.callbackUrl === 'string' ? searchParams.callbackUrl : '/dashboard';
        redirect(callbackUrl);
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-950">
            <div className="w-full max-w-md space-y-8">
                <Suspense fallback={<div className="text-white text-center">Loading...</div>}>
                    <SignUpForm />
                </Suspense>
            </div>
        </div>
    );
}
