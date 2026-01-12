'use client';

import { Play, Plus, FileDown, Settings } from 'lucide-react';

interface QuickActionsProps {
  onAddLink: () => void;
  onRunAudit: () => void;
  onExportReport: () => void;
  onSettings: () => void;
  isRunningAudit: boolean;
  className?: string;
}

export function QuickActions({
  onAddLink,
  onRunAudit,
  onExportReport,
  onSettings,
  isRunningAudit,
  className = '',
}: QuickActionsProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
      <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
      
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onAddLink}
          className="flex flex-col items-center gap-2 p-4 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors group"
        >
          <Plus className="text-indigo-600" size={24} />
          <span className="text-sm font-medium text-indigo-900">Add Link</span>
        </button>

        <button
          onClick={onRunAudit}
          disabled={isRunningAudit}
          className="flex flex-col items-center gap-2 p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="text-purple-600" size={24} />
          <span className="text-sm font-medium text-purple-900">
            {isRunningAudit ? 'Running...' : 'Run Audit'}
          </span>
        </button>

        <button
          onClick={onExportReport}
          className="flex flex-col items-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors group"
        >
          <FileDown className="text-green-600" size={24} />
          <span className="text-sm font-medium text-green-900">Export</span>
        </button>

        <button
          onClick={onSettings}
          className="flex flex-col items-center gap-2 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
        >
          <Settings className="text-gray-600" size={24} />
          <span className="text-sm font-medium text-gray-900">Settings</span>
        </button>
      </div>
    </div>
  );
}
