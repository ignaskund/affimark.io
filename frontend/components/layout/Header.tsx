/**
 * Main Header Component
 * Navigation with notification bell and user menu
 */

'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NotificationBell from '@/components/app/notifications/NotificationBell';
import UserMenu from '@/components/user/UserMenu';

export default function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Don't show header on auth pages
  if (
    pathname === '/sign-in' ||
    pathname === '/sign-up' ||
    pathname === '/verify-email' ||
    pathname === '/auth/callback'
  ) {
    return null;
  }

  const navLinks = [
    { href: '/chat', label: 'Chat' },
    { href: '/products', label: 'Products' },
    { href: '/inventory', label: 'Inventory' },
    { href: '/shop', label: 'My Shop' },
    { href: '/scanner', label: 'Scanner' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-sm border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="text-2xl font-bold text-white">
            AffiMark
          </Link>

          {/* Navigation */}
          {status === 'authenticated' && (
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? 'text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {status === 'authenticated' ? (
              <>
                {/* Notification Bell */}
                <NotificationBell />

                {/* User Menu */}
                <UserMenu />
              </>
            ) : status === 'unauthenticated' ? (
              <Link
                href="/sign-in"
                className="px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Sign In
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
