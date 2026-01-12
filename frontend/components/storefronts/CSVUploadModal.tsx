'use client';

import { useState, useRef } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ConnectedAccount {
  id: string;
  platform: string;
  storefront_name: string | null;
}

interface CSVUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: ConnectedAccount;
}

export default function CSVUploadModal({ isOpen, onClose, account }: CSVUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setUploadStatus('idle');
      setError(null);
    } else {
      setError('Please select a valid CSV file');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadStatus('idle');
    setError(null);

    try {
      // Read file as text
      const fileContent = await file.text();

      // Base64 encode for API
      const base64Content = btoa(fileContent);

      // Call API
      const response = await fetch('/api/transactions/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connected_account_id: account.id,
          platform: account.platform,
          csv_data: base64Content,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUploadStatus('success');
        setResult({
          imported: data.imported_count,
          skipped: data.skipped_count,
        });
      } else {
        setUploadStatus('error');
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      setUploadStatus('error');
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (uploadStatus === 'success') {
      // Reload page to show new transactions
      window.location.reload();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Upload Earnings Report
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {account.storefront_name} • CSV Import
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {uploadStatus === 'idle' && (
            <>
              {/* Instructions */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                  How to get your CSV:
                </h3>
                <ol className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-decimal list-inside">
                  <li>Log into {getPlatformName(account.platform)}</li>
                  <li>Go to Reports → Earnings Report</li>
                  <li>Select date range and download CSV</li>
                  <li>Upload the CSV file below</li>
                </ol>
              </div>

              {/* File Upload Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
              >
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />

                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {file.name}
                    </span>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-600 dark:text-gray-400 mb-1">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      CSV files only
                    </p>
                  </>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {error && (
                <div className="mt-4 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </>
          )}

          {uploadStatus === 'success' && result && (
            <div className="text-center py-8">
              <div className="mx-auto h-16 w-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Import Successful!
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {result.imported} transactions imported
                {result.skipped > 0 && `, ${result.skipped} duplicates skipped`}
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                View Dashboard
              </button>
            </div>
          )}

          {uploadStatus === 'error' && (
            <div className="text-center py-8">
              <div className="mx-auto h-16 w-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Import Failed
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
              <button
                onClick={() => {
                  setUploadStatus('idle');
                  setError(null);
                }}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {uploadStatus === 'idle' && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              {uploading ? 'Importing...' : 'Import Transactions'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function getPlatformName(platform: string): string {
  const names: Record<string, string> = {
    amazon_de: 'Amazon Associates Germany',
    amazon_uk: 'Amazon Associates UK',
    amazon_us: 'Amazon Associates US',
    ltk: 'LTK Creator Dashboard',
    awin: 'Awin Dashboard',
  };
  return names[platform] || platform;
}
