import { Suspense } from 'react';
import SignUpForm from '@/components/auth/SignUpForm';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Sign Up | Affimark',
    description: 'Create your Affimark account',
};

export default function SignUpPage() {
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
