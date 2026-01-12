import Link from 'next/link';

export default function SignIn() {
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/sign-in"
        className="text-gray-700 hover:text-gray-900 font-medium"
      >
        Sign In
      </Link>
      <Link
        href="/sign-up"
        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-full transition-colors"
      >
        Get Started
      </Link>
    </div>
  );
}

