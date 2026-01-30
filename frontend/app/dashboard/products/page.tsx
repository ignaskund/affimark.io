import { supabaseServer } from '@/lib/supabase-server';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Package, ExternalLink, Search, Filter, ArrowLeft, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Product {
    id: string;
    storefront_id: string;
    external_id: string | null;
    product_url: string;
    title: string;
    brand: string | null;
    image_url: string | null;
    current_price: number | null;
    platform: string;
    enrichment_status: string;
    created_at: string;
    user_storefronts: {
        id: string;
        display_name: string;
        platform: string;
        icon: string;
    };
}

function EnrichmentBadge({ status }: { status: string }) {
    if (status === 'enriched') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                Enriched
            </span>
        );
    }
    if (status === 'pending') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400">
                <Clock className="w-3 h-3" />
                Pending
            </span>
        );
    }
    if (status === 'failed') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
                <AlertCircle className="w-3 h-3" />
                Failed
            </span>
        );
    }
    return null;
}

function ProductCard({ product }: { product: Product }) {
    return (
        <div className="glass-card p-4 hover:border-white/20 transition-all group">
            <div className="flex gap-4">
                <div className="w-20 h-20 rounded-lg bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
                    {product.image_url ? (
                        <Image
                            src={product.image_url}
                            alt={product.title}
                            width={80}
                            height={80}
                            className="object-cover w-full h-full"
                            unoptimized
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-muted-foreground" />
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-foreground line-clamp-2 text-sm">
                            {product.title}
                        </h3>
                        <a
                            href={product.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        </a>
                    </div>

                    {product.brand && (
                        <p className="text-xs text-muted-foreground mt-1">{product.brand}</p>
                    )}

                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">{product.user_storefronts?.icon || '🔗'}</span>
                            <span className="text-xs text-muted-foreground capitalize">
                                {product.platform}
                            </span>
                        </div>

                        {product.current_price && (
                            <span className="text-sm font-medium text-emerald-400">
                                €{product.current_price.toFixed(2)}
                            </span>
                        )}
                    </div>

                    <div className="mt-2">
                        <EnrichmentBadge status={product.enrichment_status} />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default async function ProductsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const session = await auth();
    const user = session?.user;

    if (!user) {
        redirect('/sign-in');
    }

    const params = await searchParams;
    const page = parseInt(params.page as string || '1');
    const platform = params.platform as string | undefined;
    const storefrontId = params.storefront_id as string | undefined;
    const search = params.search as string | undefined;

    const supabase = supabaseServer;
    const limit = 20;
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
        .from('user_storefront_products')
        .select(`
            id,
            storefront_id,
            external_id,
            product_url,
            title,
            brand,
            image_url,
            current_price,
            platform,
            enrichment_status,
            created_at,
            user_storefronts!inner (
                id,
                display_name,
                platform,
                icon
            )
        `, { count: 'exact' })
        .eq('user_id', user.id);

    if (platform) {
        query = query.eq('platform', platform);
    }

    if (storefrontId) {
        query = query.eq('storefront_id', storefrontId);
    }

    if (search) {
        query = query.or(`title.ilike.%${search}%,brand.ilike.%${search}%`);
    }

    query = query.order('created_at', { ascending: false });
    query = query.range(offset, offset + limit - 1);

    const { data: products, count } = await query;

    // Get filter options
    const { data: storefronts } = await supabase
        .from('user_storefronts')
        .select('id, display_name, platform, icon')
        .eq('user_id', user.id);

    const { data: platformsData } = await supabase
        .from('user_storefront_products')
        .select('platform')
        .eq('user_id', user.id);

    const platforms = [...new Set((platformsData || []).map(p => p.platform))];
    const totalPages = Math.ceil((count || 0) / limit);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard"
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Products</h1>
                        <p className="text-sm text-muted-foreground">
                            {count || 0} products across all storefronts
                        </p>
                    </div>
                </div>

                <Link
                    href="/onboarding/magic"
                    className="btn-primary text-sm"
                >
                    Import More
                </Link>
            </div>

            {/* Filters */}
            <div className="glass-card p-4">
                <form className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <Search className="w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            name="search"
                            defaultValue={search}
                            placeholder="Search products..."
                            className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <select
                            name="platform"
                            defaultValue={platform || ''}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-foreground"
                        >
                            <option value="">All Platforms</option>
                            {platforms.map(p => (
                                <option key={p} value={p} className="bg-gray-900">
                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            name="storefront_id"
                            defaultValue={storefrontId || ''}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-foreground"
                        >
                            <option value="">All Storefronts</option>
                            {(storefronts || []).map(s => (
                                <option key={s.id} value={s.id} className="bg-gray-900">
                                    {s.icon} {s.display_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="submit"
                        className="btn-secondary text-sm"
                    >
                        Apply Filters
                    </button>

                    {(platform || storefrontId || search) && (
                        <Link
                            href="/dashboard/products"
                            className="text-sm text-muted-foreground hover:text-foreground"
                        >
                            Clear filters
                        </Link>
                    )}
                </form>
            </div>

            {/* Products Grid */}
            {(products || []).length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                        <Package className="w-8 h-8 text-indigo-400" />
                    </div>
                    <p className="text-muted-foreground mb-4">
                        {search || platform || storefrontId
                            ? 'No products found matching your filters'
                            : 'No products imported yet'}
                    </p>
                    {!search && !platform && !storefrontId && (
                        <Link
                            href="/onboarding/magic"
                            className="btn-primary text-sm inline-flex"
                        >
                            Import from Linktree
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(products as Product[]).map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    {page > 1 && (
                        <Link
                            href={`/dashboard/products?page=${page - 1}${platform ? `&platform=${platform}` : ''}${storefrontId ? `&storefront_id=${storefrontId}` : ''}${search ? `&search=${search}` : ''}`}
                            className="btn-secondary text-sm"
                        >
                            Previous
                        </Link>
                    )}

                    <span className="text-sm text-muted-foreground px-4">
                        Page {page} of {totalPages}
                    </span>

                    {page < totalPages && (
                        <Link
                            href={`/dashboard/products?page=${page + 1}${platform ? `&platform=${platform}` : ''}${storefrontId ? `&storefront_id=${storefrontId}` : ''}${search ? `&search=${search}` : ''}`}
                            className="btn-secondary text-sm"
                        >
                            Next
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
