export const config = {
  metadata: {
    title: "AffiMark",
    description: "AI-powered creator monetization platform. Connect your social accounts and discover partnership opportunities.",
  },
  app: {
    name: "AffiMark",
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },
  stripe: {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
    prices: {
      creator: process.env.NEXT_PUBLIC_STRIPE_PRICE_CREATOR || "",
      pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || "",
    },
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  },
};

export default config;

