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
    platform: string;
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
        const userEmail = (session.user as any).email;
        const userName = (session.user as any).name;

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
        // 0. GET OR CREATE PROFILE (handle NextAuth/Supabase ID mismatch)
        // ============================================
        let effectiveUserId = userId;

        // First, check if a profile exists with the NextAuth user ID
        const { data: existingProfile } = await supabaseServer
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .single();

        if (!existingProfile) {
            console.log(`[Migration Apply] No profile for NextAuth ID ${userId}, looking up by email: ${userEmail}`);

            // Check if a profile exists with the same email (different ID)
            const { data: profileByEmail } = await supabaseServer
                .from('profiles')
                .select('id, email')
                .eq('email', userEmail)
                .single();

            if (profileByEmail) {
                // Use the existing profile's user ID
                console.log(`[Migration Apply] Found existing profile by email with ID: ${profileByEmail.id}`);
                effectiveUserId = profileByEmail.id;
            } else {
                // No profile exists - try to create one with auth user
                console.log(`[Migration Apply] No profile exists for email ${userEmail}, creating auth user and profile`);

                try {
                    const randomPassword = crypto.randomUUID() + crypto.randomUUID();
                    const { data: newAuthUser, error: authCreateError } = await supabaseServer.auth.admin.createUser({
                        email: userEmail,
                        password: randomPassword,
                        email_confirm: true,
                        user_metadata: { full_name: userName, provider: 'google_oauth' },
                    });

                    if (newAuthUser?.user) {
                        effectiveUserId = newAuthUser.user.id;
                        console.log(`[Migration Apply] Created auth user: ${effectiveUserId}`);
                    } else if (authCreateError) {
                        console.log(`[Migration Apply] Auth error: ${authCreateError.message}`);

                        // User already exists - try to find them with listUsers (with page size 1 filter)
                        if (authCreateError.message?.includes('already')) {
                            try {
                                // Try listUsers with page 1 and filter
                                const { data: usersData } = await supabaseServer.auth.admin.listUsers({
                                    page: 1,
                                    perPage: 1000,  // Get first 1000 users
                                });

                                const existingUser = usersData?.users?.find(u => u.email === userEmail);
                                if (existingUser) {
                                    effectiveUserId = existingUser.id;
                                    console.log(`[Migration Apply] Found existing auth user via listUsers: ${effectiveUserId}`);
                                } else {
                                    console.log(`[Migration Apply] Could not find auth user via listUsers, will try profile insert anyway`);
                                }
                            } catch (listErr: any) {
                                console.log(`[Migration Apply] ListUsers failed: ${listErr.message}`);
                            }
                        }
                    }
                } catch (err: any) {
                    console.log(`[Migration Apply] Auth creation exception: ${err.message}`);
                }

                // Create profile with effectiveUserId
                const { error: profileError } = await supabaseServer
                    .from('profiles')
                    .insert({
                        id: effectiveUserId,
                        email: userEmail,
                        full_name: userName || userEmail?.split('@')[0] || 'User',
                        user_type: 'creator',
                        onboarding_completed: false,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    });

                if (profileError) {
                    console.error(`[Migration Apply] Profile creation error: ${profileError.message}`);
                    if (profileError.message?.includes('foreign key')) {
                        return NextResponse.json(
                            { error: 'Account sync issue. Please sign out completely, then sign back in with Google to re-sync your account.' },
                            { status: 400 }
                        );
                    }
                    return NextResponse.json(
                        { error: 'Failed to create profile.' },
                        { status: 500 }
                    );
                }
                console.log(`[Migration Apply] Profile created successfully`);
            }
        } else {
            console.log(`[Migration Apply] Profile exists for user ${userId}`);
        }

        console.log(`[Migration Apply] Using effective user ID: ${effectiveUserId}`);

        let storefrontsCreated = 0;
        let productsCreated = 0;
        let socialLinksCreated = 0;

        // ============================================
        // 1. SAVE STOREFRONTS AND PRODUCTS
        // ============================================

        if (storefronts && Array.isArray(storefronts)) {
            for (const storefront of storefronts) {
                try {
                    const { data: existingStorefront } = await supabaseServer
                        .from('user_storefronts')
                        .select('id')
                        .eq('user_id', effectiveUserId)
                        .eq('storefront_url', storefront.storefrontUrl)
                        .single();

                    let storefrontId: string;

                    if (existingStorefront) {
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
                        const { data: newStorefront, error: storefrontError } = await supabaseServer
                            .from('user_storefronts')
                            .insert({
                                user_id: effectiveUserId,
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
                            console.error(`[Migration Apply] Storefront error: ${storefrontError.message}`);
                            continue;
                        }

                        storefrontId = newStorefront.id;
                        storefrontsCreated++;
                    }

                    // Insert products
                    if (storefront.products && storefront.products.length > 0) {
                        for (const product of storefront.products) {
                            if (product.title?.startsWith('Visit ')) continue;

                            const { error: productError } = await supabaseServer
                                .from('user_storefront_products')
                                .upsert({
                                    user_id: effectiveUserId,
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
                                console.error(`[Migration Apply] Product error: ${productError.message}`);
                            } else {
                                productsCreated++;
                            }
                        }
                    }
                } catch (err: any) {
                    console.error(`[Migration Apply] Storefront ${storefront.name} error: ${err.message}`);
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
                            user_id: effectiveUserId,
                            platform: social.platform,
                            url: social.url,
                            display_name: social.name,
                            icon: social.icon,
                            updated_at: new Date().toISOString(),
                        }, {
                            onConflict: 'user_id,platform'
                        });

                    if (socialError) {
                        console.error(`[Migration Apply] Social error: ${socialError.message}`);
                    } else {
                        socialLinksCreated++;
                    }
                } catch (err: any) {
                    console.error(`[Migration Apply] Social ${social.name} error: ${err.message}`);
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
