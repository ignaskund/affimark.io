'use client';

import { ExternalLink, Package, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface TopProduct {
    title: string;
    imageUrl?: string | null;
    price?: string | null;
}

interface StorefrontData {
    id: string;
    platform: string;
    displayName: string;
    icon: string;
    storefrontUrl: string;
    productCount: number;
    lastSynced: string | null;
    syncStatus: string;
    topProducts: TopProduct[];
}

interface StorefrontBreakdownCardProps {
    storefronts: StorefrontData[];
    totalProducts: number;
}

function formatTimeAgo(dateString: string | null): string {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function SyncStatusBadge({ status }: { status: string }) {
    if (status === 'success') {
        return (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                Synced
            </span>
        );
    }
    if (status === 'error') {
        return (
            <span className="inline-flex items-center gap-1 text-xs text-red-400">
                <AlertCircle className="w-3 h-3" />
                Error
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-400">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Syncing
        </span>
    );
}

function ProductThumbnail({ product }: { product: TopProduct }) {
    return (
        <div className="relative group">
            <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                {product.imageUrl ? (
                    <Image
                        src={product.imageUrl}
                        alt={product.title}
                        width={48}
                        height={48}
                        className="object-cover w-full h-full"
                        unoptimized
                    />
                ) : (
                    <Package className="w-5 h-5 text-muted-foreground" />
                )}
            </div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 rounded text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 max-w-[200px] truncate">
                {product.title}
                {product.price && <span className="text-emerald-400 ml-1">{product.price}</span>}
            </div>
        </div>
    );
}

function StorefrontCard({ storefront }: { storefront: StorefrontData }) {
    return (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{storefront.icon}</span>
                    <div>
                        <h4 className="font-medium text-foreground">{storefront.displayName}</h4>
                        <p className="text-xs text-muted-foreground capitalize">{storefront.platform}</p>
                    </div>
                </div>
                <a
                    href={storefront.storefrontUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </a>
            </div>

            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">{storefront.productCount} products</span>
                </div>
                <SyncStatusBadge status={storefront.syncStatus} />
            </div>

            {storefront.topProducts.length > 0 && (
                <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                    {storefront.topProducts.slice(0, 4).map((product, idx) => (
                        <ProductThumbnail key={idx} product={product} />
                    ))}
                    {storefront.productCount > 4 && (
                        <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs text-muted-foreground">
                            +{storefront.productCount - 4}
                        </div>
                    )}
                </div>
            )}

            <p className="text-xs text-muted-foreground mt-3">
                Last synced: {formatTimeAgo(storefront.lastSynced)}
            </p>
        </div>
    );
}

export default function StorefrontBreakdownCard({ storefronts, totalProducts }: StorefrontBreakdownCardProps) {
    if (storefronts.length === 0) {
        return (
            <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-foreground">Connected Storefronts</h3>
                </div>
                <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                        <Package className="w-8 h-8 text-indigo-400" />
                    </div>
                    <p className="text-muted-foreground mb-4">No storefronts imported yet</p>
                    <Link
                        href="/onboarding/magic"
                        className="btn-primary text-sm inline-flex"
                    >
                        Import from Linktree
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-foreground">Connected Storefronts</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        {storefronts.length} storefront{storefronts.length !== 1 ? 's' : ''} • {totalProducts} products
                    </p>
                </div>
                <Link
                    href="/dashboard/storefronts"
                    className="text-sm transition-colors"
                    style={{ color: 'var(--color-brand)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-brand-strong)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-brand)'}
                >
                    View all
                </Link>
            </div>

            <div className="grid gap-4">
                {storefronts.slice(0, 3).map((storefront) => (
                    <StorefrontCard key={storefront.id} storefront={storefront} />
                ))}
            </div>

            {storefronts.length > 3 && (
                <Link
                    href="/dashboard/storefronts"
                    className="block text-center text-sm text-muted-foreground hover:text-foreground mt-4 pt-4 border-t border-white/10 transition-colors"
                >
                    + {storefronts.length - 3} more storefronts
                </Link>
            )}
        </div>
    );
}
