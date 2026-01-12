'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import ConnectStorefrontModal from './ConnectStorefrontModal';

interface ConnectStorefrontButtonProps {
  variant?: 'primary' | 'secondary';
}

export default function ConnectStorefrontButton({
  variant = 'primary',
}: ConnectStorefrontButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const buttonClasses =
    variant === 'primary'
      ? 'px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all'
      : 'px-6 py-2.5 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-all';

  return (
    <>
      <button onClick={() => setModalOpen(true)} className={buttonClasses}>
        <span className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Connect Storefront
        </span>
      </button>

      <ConnectStorefrontModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
