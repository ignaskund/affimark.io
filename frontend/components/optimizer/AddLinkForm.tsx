'use client';

import { useState } from 'react';
import { Plus, Link2, Loader2, X } from 'lucide-react';

interface AddLinkFormProps {
  onAdd: (url: string, name?: string) => Promise<void>;
  isAdding: boolean;
}

export default function AddLinkForm({ onAdd, isAdding }: AddLinkFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    try {
      await onAdd(url.trim(), name.trim() || undefined);
      setUrl('');
      setName('');
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add link');
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full p-4 border-2 border-dashed border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all group"
      >
        <div className="flex items-center justify-center gap-2 text-muted-foreground group-hover:text-primary">
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add new link</span>
        </div>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border border-border rounded-xl bg-card space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-foreground flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          Add Product Link
        </h4>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-muted rounded transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-muted-foreground mb-1.5">
            Product URL <span className="text-red-400">*</span>
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://amazon.de/dp/B09V3KXJPB or any affiliate link"
            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-1.5">
            Product Name <span className="text-muted-foreground/50">(optional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Sony WH-1000XM5 Headphones"
            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="flex-1 px-4 py-2.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isAdding || !url.trim()}
          className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isAdding ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Add Link
            </>
          )}
        </button>
      </div>
    </form>
  );
}
