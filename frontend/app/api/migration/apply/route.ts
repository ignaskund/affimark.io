import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase-server';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface ProductData {
    url: string;
    title: string;
    retailer?: string;
    image?: string;
    price?: string;
    externalId?: string;
    brand?: string;
    category?: string;
}

interface StorefrontData {
    name: string;
    icon: string;
    storefrontUrl: string;
    platform: string;
    products: ProductData[];
}

interface SocialMediaData {
    name: string;
    icon: string;
    url: string;
    platform: string;
}

interface MigrationPayload {
    storefronts: StorefrontData[];
    socialMedia: SocialMediaData[];
    platform: string;  // The link-in-bio platform (linktree, beacons, etc.)
}

// ============================================
// API ROUTE HANDLER
// ============================================

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const userId = (session.user as any).id;

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID not found' },
                { status: 400 }
            );
        }

        const data: MigrationPayload = await request.json();
        const { storefronts, socialMedia, platform } = data;

        console.log(`[Migration Apply] User ${userId} importing from ${platform}`);
        console.log(`[Migration Apply] ${storefronts?.length || 0} storefronts, ${socialMedia?.length || 0} social links`);

        // ============================================
        // 0. ENSURE PROFILE EXISTS (for foreign key constraint)
        // ============================================
        const { data: existingProfile } = await supabaseServer
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .single();

        if (!existingProfile) {
            console.log(`[Migration Apply] Profile doesn't exist, creating for user ${userId}`);
            const userEmail = (session.user as any).email;
            const userName = (session.user as any).name;

            const { error: profileError } = await supabaseServer
                .from('profiles')
                .insert({
                    id: userId,
                    email: userEmail,
                    full_name: userName || userEmail?.split('@')[0] || 'User',
                    user_type: 'creator',
                    onboarding_completed: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });

            if (profileError) {
                console.error(`[Migration Apply] Failed to create profile: ${profileError.message}`);
                return NextResponse.json(
                    { error: 'Failed to create user profile. Please try signing out and back in.' },
                    { status: 500 }
                );
            }
            console.log(`[Migration Apply] Profile created successfully`);
        }

        let storefrontsCreated = 0;
        let productsCreated = 0;
        let socialLinksCreated = 0;

        // ============================================
        // 1. SAVE STOREFRONTS AND PRODUCTS
        // ============================================

        if (storefronts && Array.isArray(storefronts)) {
            for (const storefront of storefronts) {
                try {
                    // Insert or update storefront
                    const { data: existingStorefront } = await supabaseServer
                        .from('user_storefronts')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('storefront_url', storefront.storefrontUrl)
                        .single();

                    let storefrontId: string;

                    if (existingStorefront) {
                        // Update existing
                        storefrontId = existingStorefront.id;
                        await supabaseServer
                            .from('user_storefronts')
                            .update({
                                display_name: storefront.name,
                                icon: storefront.icon,
                                platform: storefront.platform,
                                sync_status: 'success',
                                last_synced_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', storefrontId);
                    } else {
                        // Create new
                        const { data: newStorefront, error: storefrontError } = await supabaseServer
                            .from('user_storefronts')
                            .insert({
                                user_id: userId,
                                platform: storefront.platform,
                                storefront_url: storefront.storefrontUrl,
                                display_name: storefront.name,
                                icon: storefront.icon,
                                sync_status: 'success',
                                last_synced_at: new Date().toISOString(),
                            })
                            .select('id')
                            .single();

                        if (storefrontError) {
                            console.error(`[Migration Apply] Error creating storefront: ${storefrontError.message}`);
                            continue;
                        }

                        storefrontId = newStorefront.id;
                        storefrontsCreated++;
                    }

                    // Insert products for this storefront
                    if (storefront.products && storefront.products.length > 0) {
                        for (const product of storefront.products) {
                            // Skip placeholder products
                            if (product.title?.startsWith('Visit ')) continue;

                            const { error: productError } = await supabaseServer
                                .from('user_storefront_products')
                                .upsert({
                                    user_id: userId,
                                    storefront_id: storefrontId,
                                    external_id: product.externalId || null,
                                    product_url: product.url,
                                    title: product.title,
                                    brand: product.brand || product.retailer,
                                    image_url: product.image,
                                    current_price: product.price ? parseFloat(product.price.replace(/[^0-9.]/g, '')) : null,
                                    platform: storefront.platform,
                                    enrichment_status: product.externalId ? 'pending' : 'skipped',
                                    updated_at: new Date().toISOString(),
                                }, {
                                    onConflict: 'storefront_id,product_url'
                                });

                            if (productError) {
                                console.error(`[Migration Apply] Error creating product: ${productError.message}`);
                            } else {
                                productsCreated++;
                            }
                        }
                    }
                } catch (err: any) {
                    console.error(`[Migration Apply] Error processing storefront ${storefront.name}: ${err.message}`);
                }
            }
        }

        // ============================================
        // 2. SAVE SOCIAL MEDIA LINKS
        // ============================================

        if (socialMedia && Array.isArray(socialMedia)) {
            for (const social of socialMedia) {
                try {
                    const { error: socialError } = await supabaseServer
                        .from('user_social_links')
                        .upsert({
                            user_id: userId,
                            platform: social.platform,
                            url: social.url,
                            display_name: social.name,
                            icon: social.icon,
                            updated_at: new Date().toISOString(),
                        }, {
                            onConflict: 'user_id,platform'
                        });

                    if (socialError) {
                        console.error(`[Migration Apply] Error creating social link: ${socialError.message}`);
                    } else {
                        socialLinksCreated++;
                    }
                } catch (err: any) {
                    console.error(`[Migration Apply] Error processing social ${social.name}: ${err.message}`);
                }
            }
        }

        console.log(`[Migration Apply] Complete: ${storefrontsCreated} storefronts, ${productsCreated} products, ${socialLinksCreated} social links`);

        return NextResponse.json({
            success: true,
            storefrontsCreated,
            productsCreated,
            socialLinksCreated,
            message: `Successfully imported ${storefrontsCreated} storefronts with ${productsCreated} products`
        });

    } catch (error: any) {
        console.error('[Migration Apply] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to apply migration' },
            { status: 500 }
        );
    }
}
