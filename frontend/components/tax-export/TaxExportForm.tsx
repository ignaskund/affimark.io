'use client';

import { useState } from 'react';
import { Download, FileText, Loader2, CheckCircle2 } from 'lucide-react';

interface TaxPersona {
  id: string;
  persona_name: string;
  country_code: string;
  description: string;
}

interface TaxExportFormProps {
  userId: string;
  selectedPersonaId: string | null;
  personas: TaxPersona[];
  earliestDate: string | null;
  latestDate: string | null;
}

export default function TaxExportForm({
  userId,
  selectedPersonaId,
  personas,
  earliestDate,
  latestDate,
}: TaxExportFormProps) {
  const [personaId, setPersonaId] = useState(selectedPersonaId || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuickSelect = (period: 'ytd' | '2024' | '2023' | 'all') => {
    const today = new Date();
    let start = '';
    let end = today.toISOString().split('T')[0];

    switch (period) {
      case 'ytd':
        start = `${today.getFullYear()}-01-01`;
        break;
      case '2024':
        start = '2024-01-01';
        end = '2024-12-31';
        break;
      case '2023':
        start = '2023-01-01';
        end = '2023-12-31';
        break;
      case 'all':
        start = earliestDate || '';
        end = latestDate || '';
        break;
    }

    setStartDate(start);
    setEndDate(end);
  };

  const handleExport = async () => {
    if (!startDate || !endDate) {
      setError('Please select start and end dates');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const endpoint = exportFormat === 'csv' ? '/api/export/csv' : '/api/export/pdf';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          persona_id: personaId || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      if (exportFormat === 'csv') {
        // Download CSV file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `affimark-export-${startDate}-to-${endDate}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // PDF export (currently returns JSON)
        const data = await response.json();
        setError(data.message || 'PDF export coming soon - use CSV for now');
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Export Settings</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Configure your tax export with date range and formatting options
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Tax Persona Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tax Persona (Optional)
          </label>
          <select
            value={personaId}
            onChange={(e) => setPersonaId(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          >
            <option value="">Generic EU Format</option>
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.persona_name} ({persona.country_code})
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            Selecting a persona formats columns for region-specific tax reporting
          </p>
        </div>

        {/* Quick Date Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quick Select
          </label>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => handleQuickSelect('ytd')}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              YTD {new Date().getFullYear()}
            </button>
            <button
              onClick={() => handleQuickSelect('2024')}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              2024
            </button>
            <button
              onClick={() => handleQuickSelect('2023')}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              2023
            </button>
            <button
              onClick={() => handleQuickSelect('all')}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              All Time
            </button>
          </div>
        </div>

        {/* Custom Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            />
          </div>
        </div>

        {/* Export Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Export Format
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setExportFormat('csv')}
              className={`px-4 py-3 border-2 rounded-lg transition-all ${
                exportFormat === 'csv'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
              }`}
            >
              <FileText className="h-5 w-5 mx-auto mb-1 text-blue-600" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">CSV</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Excel compatible</p>
            </button>
            <button
              onClick={() => setExportFormat('pdf')}
              disabled
              className="px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg opacity-50 cursor-not-allowed"
            >
              <FileText className="h-5 w-5 mx-auto mb-1 text-gray-400" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">PDF</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Coming soon</p>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <p className="text-sm font-medium">Export downloaded successfully!</p>
            </div>
          </div>
        )}

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={loading || !startDate || !endDate}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating Export...
            </>
          ) : (
            <>
              <Download className="h-5 w-5" />
              Download {exportFormat.toUpperCase()}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
