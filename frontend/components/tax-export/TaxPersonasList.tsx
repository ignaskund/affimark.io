'use client';

import { Info } from 'lucide-react';

interface TaxPersona {
  id: string;
  persona_name: string;
  country_code: string;
  description: string;
  column_format: any;
}

interface TaxPersonasListProps {
  personas: TaxPersona[];
}

const COUNTRY_FLAGS: Record<string, string> = {
  DE: '🇩🇪',
  UK: '🇬🇧',
  NL: '🇳🇱',
  FR: '🇫🇷',
  LT: '🇱🇹',
  EU: '🇪🇺',
};

export default function TaxPersonasList({ personas }: TaxPersonasListProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tax Personas</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Pre-configured formats for different EU tax situations
        </p>
      </div>

      <div className="p-6 space-y-4">
        {personas.map((persona) => (
          <div
            key={persona.id}
            className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{COUNTRY_FLAGS[persona.country_code] || '🌍'}</span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {persona.persona_name}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{persona.description}</p>

                {/* Show sample columns */}
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    CSV Columns:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {persona.column_format &&
                      Object.keys(persona.column_format).map((col) => (
                        <span
                          key={col}
                          className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded"
                        >
                          {col}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-300">How Tax Personas Work</p>
              <ul className="mt-2 text-xs text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
                <li>Each persona formats CSV columns for specific tax structures</li>
                <li>Column names match local accounting software expectations</li>
                <li>VAT/BTW columns included where applicable</li>
                <li>Currency automatically converted to home currency</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Example Preview */}
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Example: German Freelancer (EÜR Format)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-2 py-1 text-left">Datum</th>
                  <th className="px-2 py-1 text-left">Geschäftspartner</th>
                  <th className="px-2 py-1 text-right">Betrag (EUR)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-2 py-1 text-gray-600 dark:text-gray-400">2024-01-15</td>
                  <td className="px-2 py-1 text-gray-600 dark:text-gray-400">Amazon DE</td>
                  <td className="px-2 py-1 text-right text-gray-600 dark:text-gray-400">42.50</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
