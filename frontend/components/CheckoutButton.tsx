'use client';

import { loadStripe } from '@stripe/stripe-js';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useState } from 'react';

interface CheckoutButtonProps {
	priceId: string;
	productId: string;
	className?: string;
}

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY 
	? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
	: null;

export default function CheckoutButton({ priceId, productId, className }: CheckoutButtonProps) {
	const { data: session } = useSession();
	const user = session?.user;
	const email = user?.email;
	const [isLoading, setIsLoading] = useState(false);

	const handleCheckout = async () => {
		if (!user) {
			toast.error("Please log in first");
			redirect('/api/auth/signin?callbackUrl=/');
			return;
		}

		// If it's a free plan (empty priceId), redirect to dashboard
		if (!priceId) {
			redirect('/dashboard');
			return;
		}

		// Check if Stripe is configured
		if (!stripePromise) {
			toast.error("Stripe is not configured yet");
			return;
		}

		setIsLoading(true);
		console.log('Loading started:', isLoading);

		const stripe = await stripePromise;
		const response = await fetch('/api/checkout', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				priceId: priceId,
				productId: productId,
				userId: user?.id,
				email: email,
			}),
		});
		const session = await response.json();

		if (response.ok) {
			await stripe?.redirectToCheckout({ sessionId: session.id });
		} else if (response.status === 400) {
			toast.success('You are already subscribed');
			redirect('/dashboard');
		} else {
			toast.error('Something went wrong');
		}

		setIsLoading(false);
	}

	return (
		<div>
			<button
				className={className || `w-full rounded-lg py-2 transition-colors ${isLoading
					? 'bg-gray-400 cursor-not-allowed'
					: 'bg-[#5059FE] hover:bg-[#4048ed]'
					} text-white`}
				onClick={handleCheckout}
				disabled={isLoading}
			>
				{isLoading ? 'Processing...' : !priceId ? 'Get Started' : 'Buy Now'}
			</button>
		</div>
	);
}