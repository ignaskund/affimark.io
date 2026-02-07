import { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { MerchantBadge } from '@/components/product-search';

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: { handle: string } }): Promise<Metadata> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/shops/public/${params.handle}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      return {
        title: 'Shop Not Found',
      };
    }

    const { shop } = await response.json();

    const title = `${shop.shop_name} - Affimark`;
    const description = shop.shop_tagline || `Shop ${shop.shop_name}'s curated product recommendations`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: shop.banner_image_url ? [shop.banner_image_url] : [],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: shop.banner_image_url ? [shop.banner_image_url] : [],
      },
    };
  } catch (error) {
    return {
      title: 'Shop Not Found',
    };
  }
}

export default async function PublicShopPage({ params }: { params: { handle: string } }) {
  let shop: any = null;
  let shopItems: any[] = [];

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/shops/public/${params.handle}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      notFound();
    }

    const data = await response.json();
    shop = data.shop;
    shopItems = data.items?.filter((item: any) => item.is_visible) || [];
  } catch (error) {
    notFound();
  }

  // Group items by section
  const itemsBySection = shopItems.reduce((acc: Record<string, any[]>, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }
    acc[item.section].push(item);
    return acc;
  }, {});

  const sections = Object.keys(itemsBySection);

  // Format price
  const formatPrice = (price?: number, currency?: string) => {
    if (!price) return 'Price unavailable';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(price);
  };

  return (
    <>
      {/* Schema.org structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Store',
            name: shop.shop_name,
            description: shop.shop_description || shop.shop_tagline,
            url: `https://affimark.io/shop/${params.handle}`,
            image: shop.banner_image_url,
            makesOffer: shopItems.map((item: any) => ({
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Product',
                name:
                  item.inventory_item?.custom_title ||
                  item.inventory_item?.product?.product_name,
                image: item.inventory_item?.product?.image_url,
                description: item.inventory_item?.custom_description,
              },
              price: item.inventory_item?.product?.price,
              priceCurrency: item.inventory_item?.product?.currency || 'USD',
            })),
          }),
        }}
      />

      <div className="min-h-screen bg-black">
        {/* Banner */}
        {shop.banner_image_url && (
          <div className="relative h-64 w-full" style={{ backgroundColor: shop.theme_color || '#9333ea' }}>
            <Image src={shop.banner_image_url} alt={shop.shop_name} fill className="object-cover" />
          </div>
        )}

        {/* Shop Header */}
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="mb-2 text-4xl font-bold text-white">{shop.shop_name}</h1>
            {shop.shop_tagline && <p className="text-xl text-gray-400">{shop.shop_tagline}</p>}
            {shop.shop_description && (
              <p className="mt-4 text-gray-300">{shop.shop_description}</p>
            )}
          </div>

          {/* Products by Section */}
          {sections.length === 0 ? (
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-12 text-center">
              <p className="text-gray-400">No products available yet</p>
            </div>
          ) : (
            <div className="space-y-12">
              {sections.map((section) => (
                <section key={section}>
                  <h2 className="mb-6 text-2xl font-semibold text-white">{section}</h2>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {itemsBySection[section].map((item: any) => {
                      const product = item.inventory_item?.product;
                      const affiliateLink = item.inventory_item?.affiliate_link;
                      const discountCode = affiliateLink?.discount_code;

                      return (
                        <a
                          key={item.id}
                          href={affiliateLink?.affiliate_url || product?.product_url || '#'}
                          target="_blank"
                          rel="noopener noreferrer sponsored"
                          className="group relative flex flex-col overflow-hidden rounded-lg border border-gray-800 bg-gray-900/50 transition-all hover:border-gray-700"
                        >
                          {/* Product Image */}
                          {product?.image_url && (
                            <div className="relative aspect-square w-full overflow-hidden bg-gray-800">
                              <Image
                                src={product.image_url}
                                alt={item.inventory_item?.custom_title || product?.product_name || 'Product'}
                                fill
                                className="object-cover transition-transform group-hover:scale-105"
                              />
                              {product?.merchant && (
                                <div className="absolute left-2 top-2">
                                  <MerchantBadge merchantKey={product.merchant.merchant_slug} />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Product Info */}
                          <div className="flex flex-1 flex-col p-4">
                            <h3 className="mb-2 text-base font-semibold text-white group-hover:text-purple-400">
                              {item.inventory_item?.custom_title || product?.product_name}
                            </h3>

                            {item.inventory_item?.custom_description && (
                              <p className="mb-3 line-clamp-2 text-sm text-gray-400">
                                {item.inventory_item.custom_description}
                              </p>
                            )}

                            <div className="mt-auto">
                              {product?.price && (
                                <p className="mb-2 text-lg font-bold text-white">
                                  {formatPrice(product.price, product.currency)}
                                </p>
                              )}

                              {discountCode && (
                                <div className="rounded-md bg-green-500/10 px-2 py-1">
                                  <p className="text-xs text-green-400">
                                    Code: <span className="font-mono font-semibold">{discountCode}</span>
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* External Link Icon */}
                          <div className="absolute right-2 top-2 rounded-full bg-black/50 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <svg
                              className="h-4 w-4 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-16 border-t border-gray-800 py-8">
          <div className="container mx-auto px-4 text-center text-sm text-gray-500">
            <p>
              Powered by{' '}
              <a
                href="https://affimark.io"
                className="text-purple-400 hover:text-purple-300"
                target="_blank"
                rel="noopener noreferrer"
              >
                Affimark
              </a>
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
