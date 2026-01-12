/**
 * Migration Wizard Page
 *
 * 3-Step wizard to import links from Linktree/Beacons/Stan
 * Step 1: Enter URL
 * Step 2: Preview scraped links
 * Step 3: Confirm and create SmartWrappers
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {  ArrowLeft, ArrowRight, Link2, CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface ScrapedLink {
  title: string;
  url: string;
  position: number;
  isAffiliate: boolean;
  detectedNetwork?: string;
  affiliateTag?: string;
}

interface MigrationResult {
  platform: string;
  totalLinks: number;
  affiliateLinks: number;
  links: ScrapedLink[];
  suggestions: string[];
}

export default function MigrationWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: URL input
  const [pageUrl, setPageUrl] = useState('');

  // Step 2: Scraped results
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [selectedLinks, setSelectedLinks] = useState<Set<number>>(new Set());

  // Step 3: Import status
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; failed: number }>({
    success: 0,
    failed: 0,
  });

  // Step 1: Scrape page
  const handleScrape = async () => {
    if (!pageUrl) {
      alert('Please enter a URL');
      return;
    }

    setLoading(true);

    try {
      // Call migration scraper API
      const response = await fetch('/api/migration/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pageUrl }),
      });

      if (!response.ok) {
        throw new Error('Failed to scrape page');
      }

      const data = await response.json();
      setMigrationResult(data);

      // Auto-select all affiliate links
      const affiliateLinkIndices = data.links
        .map((link: ScrapedLink, index: number) => (link.isAffiliate ? index : -1))
        .filter((index: number) => index !== -1);

      setSelectedLinks(new Set(affiliateLinkIndices));
      setStep(2);
    } catch (error: any) {
      alert('Failed to scrape page: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Toggle link selection
  const toggleLink = (index: number) => {
    const newSelected = new Set(selectedLinks);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedLinks(newSelected);
  };

  // Step 3: Import selected links
  const handleImport = async () => {
    if (selectedLinks.size === 0) {
      alert('Please select at least one link to import');
      return;
    }

    setImporting(true);
    setStep(3);

    try {
      const linksToImport = Array.from(selectedLinks).map((index) => migrationResult!.links[index]);

      let success = 0;
      let failed = 0;

      // Create SmartWrapper for each selected link
      for (const link of linksToImport) {
        try {
          const response = await fetch('/api/smartwrappers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: link.title,
              productName: link.title,
              destinations: [
                {
                  url: link.url,
                  priority: 1,
                  retailer: link.detectedNetwork || 'Unknown',
                  affiliate_tag: link.affiliateTag,
                },
              ],
              isAutopilotEnabled: true,
            }),
          });

          if (response.ok) {
            success++;
          } else {
            failed++;
          }
        } catch (error) {
          failed++;
        }

        // Update progress
        setImportResults({ success, failed });
      }

      setImporting(false);
    } catch (error) {
      setImporting(false);
      alert('Import failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : router.push('/smartwrappers'))}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={20} />
            {step > 1 ? 'Back' : 'Cancel'}
          </button>

          <h1 className="text-3xl font-bold text-gray-900">Migration Wizard</h1>
          <p className="mt-1 text-gray-600">Import your links from Linktree, Beacons, or Stan</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Enter URL' },
              { num: 2, label: 'Select Links' },
              { num: 3, label: 'Import' },
            ].map((s) => (
              <div key={s.num} className="flex items-center flex-1">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
                    step >= s.num
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step > s.num ? '✓' : s.num}
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${step >= s.num ? 'text-gray-900' : 'text-gray-500'}`}>
                    {s.label}
                  </p>
                </div>
                {s.num < 3 && (
                  <div className={`flex-1 h-1 mx-4 ${step > s.num ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Enter URL */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter Your Link-in-Bio URL</h2>
              <p className="text-gray-600">
                We'll scrape your page and identify affiliate links to import
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Page URL</label>
              <input
                type="url"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="https://linktr.ee/yourcreator"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-900 font-medium mb-2">Supported Platforms:</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Linktree (linktr.ee)</li>
                <li>• Beacons (beacons.ai)</li>
                <li>• Stan Store (stan.store)</li>
                <li>• Carrd (carrd.co)</li>
                <li>• Custom HTML pages</li>
              </ul>
            </div>

            <button
              onClick={handleScrape}
              disabled={loading || !pageUrl}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  Scraping page...
                </>
              ) : (
                <>
                  <ArrowRight size={20} />
                  Scan Page
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 2: Select Links */}
        {step === 2 && migrationResult && (
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Links to Import</h2>
              <p className="text-gray-600">
                Found {migrationResult.totalLinks} links ({migrationResult.affiliateLinks} affiliate links)
              </p>
            </div>

            {/* Platform Detection */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-900 font-medium mb-2">
                ✓ Detected Platform: <span className="capitalize">{migrationResult.platform}</span>
              </p>
              <ul className="text-sm text-green-800 space-y-1">
                {migrationResult.suggestions.map((suggestion, i) => (
                  <li key={i}>• {suggestion}</li>
                ))}
              </ul>
            </div>

            {/* Link Selection */}
            <div className="max-h-96 overflow-y-auto mb-6 border border-gray-200 rounded-lg">
              {migrationResult.links.map((link, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                    selectedLinks.has(index) ? 'bg-indigo-50' : ''
                  }`}
                  onClick={() => toggleLink(index)}
                >
                  <input
                    type="checkbox"
                    checked={selectedLinks.has(index)}
                    onChange={() => toggleLink(index)}
                    className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Link2 size={16} className="text-gray-400" />
                      <p className="font-medium text-gray-900">{link.title || 'Untitled Link'}</p>
                      {link.isAffiliate && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded">
                          Affiliate
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 font-mono truncate">{link.url}</p>

                    {link.detectedNetwork && (
                      <p className="text-xs text-gray-500 mt-1">
                        Network: {link.detectedNetwork}
                        {link.affiliateTag && ` • Tag: ${link.affiliateTag}`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={selectedLinks.size === 0}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRight size={20} />
                Import {selectedLinks.size} Links
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Import Progress */}
        {step === 3 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            {importing ? (
              <>
                <Loader className="animate-spin mx-auto mb-4 text-indigo-600" size={48} />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Importing Links...</h2>
                <p className="text-gray-600 mb-6">
                  Creating SmartWrappers: {importResults.success + importResults.failed} / {selectedLinks.size}
                </p>

                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${((importResults.success + importResults.failed) / selectedLinks.size) * 100}%`,
                    }}
                  ></div>
                </div>
              </>
            ) : (
              <>
                <CheckCircle className="mx-auto mb-4 text-green-600" size={48} />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Complete!</h2>
                <p className="text-gray-600 mb-6">
                  Successfully created {importResults.success} SmartWrappers
                  {importResults.failed > 0 && ` (${importResults.failed} failed)`}
                </p>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-green-900 font-medium mb-2">✓ What's Next?</p>
                  <ul className="text-sm text-green-800 text-left space-y-1">
                    <li>• Replace links in your Linktree with new SmartWrapper URLs</li>
                    <li>• Add backup destinations to your priority chains</li>
                    <li>• Enable autopilot for automatic health monitoring</li>
                    <li>• Set up schedules for flash sales</li>
                  </ul>
                </div>

                <button
                  onClick={() => router.push('/smartwrappers')}
                  className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
                >
                  View My SmartWrappers
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
