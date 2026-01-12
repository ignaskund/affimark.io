'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import CreateSmartWrapperModal from './CreateSmartWrapperModal';

interface CreateSmartWrapperButtonProps {
  userId: string;
}

export default function CreateSmartWrapperButton({ userId }: CreateSmartWrapperButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all"
      >
        <Plus className="h-5 w-5" />
        Create SmartWrapper
      </button>

      <CreateSmartWrapperModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        userId={userId}
      />
    </>
  );
}
