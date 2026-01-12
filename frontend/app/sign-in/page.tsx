import { Suspense } from 'react';
import SignInForm from '@/components/auth/SignInForm';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Sign In | Affimark',
    description: 'Sign in to your Affimark account',
};

export default function SignInPage() {
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
