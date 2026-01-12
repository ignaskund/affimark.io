'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { InventoryTable, InventoryEditModal, InventoryItem } from '@/components/inventory';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'active' | 'archived'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edit Modal
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Fetch inventory
  const fetchInventory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/inventory?${params}`,
        {
          headers: {
            'X-User-ID': 'current-user-id', // TODO: Get from auth context
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch inventory');
      }

      const data = await response.json();
      setItems(data.items || []);
      setFilteredItems(data.items || []);

      // Extract unique categories
      const uniqueCategories = Array.from(
        new Set(
          data.items
            ?.map((item: InventoryItem) => item.category)
            .filter(Boolean)
        )
      );
      setCategories(uniqueCategories as string[]);
    } catch (err) {
      console.error('Fetch inventory error:', err);
      setError('Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [statusFilter, categoryFilter, searchQuery]);

  // Filter items locally
  useEffect(() => {
    let filtered = items;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter((item) => item.category === categoryFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.custom_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.product?.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.custom_description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredItems(filtered);
  }, [items, statusFilter, categoryFilter, searchQuery]);

  // Handle edit
  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  // Handle save edit
  const handleSaveEdit = async (itemId: string, updates: Partial<InventoryItem>) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/inventory/${itemId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': 'current-user-id',
          },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update item');
      }

      await fetchInventory();
    } catch (error) {
      console.error('Update error:', error);
      throw error;
    }
  };

  // Handle delete
  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/inventory/${itemId}`,
        {
          method: 'DELETE',
          headers: {
            'X-User-ID': 'current-user-id',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      await fetchInventory();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete item');
    }
  };

  // Handle status change
  const handleStatusChange = async (itemId: string, status: 'draft' | 'active' | 'archived') => {
    try {
      await handleSaveEdit(itemId, { status });
    } catch (error) {
      console.error('Status change error:', error);
    }
  };

  // Handle bulk actions
  const handleBulkStatusChange = async (status: 'draft' | 'active' | 'archived') => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/inventory/bulk`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': 'current-user-id',
          },
          body: JSON.stringify({
            updates: Array.from(selectedIds).map((id) => ({ id, status })),
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update items');
      }

      setSelectedIds(new Set());
      await fetchInventory();
    } catch (error) {
      console.error('Bulk update error:', error);
      alert('Failed to update items');
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} items?`)) {
      return;
    }

    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/inventory/${id}`,
            {
              method: 'DELETE',
              headers: {
                'X-User-ID': 'current-user-id',
              },
            }
          )
        )
      );

      setSelectedIds(new Set());
      await fetchInventory();
    } catch (error) {
      console.error('Bulk delete error:', error);
      alert('Failed to delete items');
    }
  };

  return (
    <AppShell>
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-white">Inventory</h1>
          <p className="text-gray-400">
            Manage your product inventory and affiliate links
          </p>
        </div>
        <Button onClick={() => router.push('/products')}>
          <svg
            className="mr-2 h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Search Products
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inventory..."
            className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-2 text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-2 text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-purple-500/50 bg-purple-500/10 p-4">
          <span className="text-sm font-medium text-white">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBulkStatusChange('active')}
            >
              Mark Active
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBulkStatusChange('draft')}
            >
              Mark Draft
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBulkStatusChange('archived')}
            >
              Archive
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkDelete}
              className="text-red-400 hover:text-red-300"
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Inventory Table */}
      <InventoryTable
        items={filteredItems}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
        onBulkSelect={(ids) => setSelectedIds(new Set(ids))}
        selectedIds={selectedIds}
      />

      {/* Edit Modal */}
      <InventoryEditModal
        item={editingItem}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveEdit}
      />
    </div>
    </AppShell>
  );
}
