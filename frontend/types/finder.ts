// Product Finder Types

export interface Priority {
  id: string;
  rank: number;
}

export interface PriorityOption {
  id: string;
  type: 'product' | 'brand';
  label: string;
  description: string;
  icon: string;
}

export interface ActiveContext {
  socials: string[];
  storefronts: string[];
}

export interface UserPriorities {
  productPriorities: Priority[];
  brandPriorities: Priority[];
  activeContext: ActiveContext;
  onboardingCompleted: boolean;
}

export interface FinderSession {
  id: string;
  userId: string;
  inputType: 'url' | 'category';
  inputValue: string;
  productPrioritiesSnapshot: Priority[];
  brandPrioritiesSnapshot: Priority[];
  activeContextSnapshot: ActiveContext;
  originalProduct: ProductData | null;
  alternatives: AlternativeProduct[];
  alternativesCount: number;
  currentIndex: number;
  viewedAlternatives: string[];
  savedAlternatives: string[];
  skippedAlternatives: string[];
  selectedAlternativeId: string | null;
  chatMessages: ChatMessage[];
  status: 'searching' | 'ready' | 'browsing' | 'completed' | 'failed';
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductData {
  url: string;
  name: string;
  brand: string;
  category: string;
  imageUrl: string;
  price: number;
  currency: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
}

export interface AlternativeProduct extends ProductData {
  id: string;
  matchScore: number;
  matchReasons: string[];
  priorityAlignment: PriorityAlignment;
  affiliateNetwork?: string;
  commissionRate?: number;
  cookieDurationDays?: number;
  pros: string[];
  cons: string[];
}

export interface PriorityAlignment {
  [priorityId: string]: {
    score: number; // 0-100
    reason: string;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  context?: {
    productId?: string;
    action?: string;
  };
}

export interface SavedProduct {
  id: string;
  userId: string;
  finderSessionId?: string;
  productUrl: string;
  productName: string;
  brand: string;
  category: string;
  imageUrl: string;
  price: number;
  currency: string;
  matchScore: number;
  matchReasons: string[];
  priorityAlignment: PriorityAlignment;
  listType: 'saved' | 'try_first' | 'content_calendar' | 'rejected';
  notes?: string;
  tags: string[];
  affiliateNetwork?: string;
  affiliateLink?: string;
  commissionRate?: number;
  cookieDurationDays?: number;
  isArchived: boolean;
  promotedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialContextAnalysis {
  id: string;
  platform: string;
  followerCount?: number;
  avgEngagementRate?: number;
  primaryAudienceAge?: string;
  primaryAudienceGender?: string;
  primaryAudienceLocation?: string;
  contentCategories: string[];
  detectedNiches: string[];
  brandAffinitySignals: string[];
  analyzedAt: string;
}

// Product priority options
export const PRODUCT_PRIORITIES: PriorityOption[] = [
  { id: 'quality', type: 'product', label: 'Quality & Durability', description: 'Products built to last with premium materials', icon: 'shield-check' },
  { id: 'price', type: 'product', label: 'Price & Value', description: 'Best bang for the buck, affordable options', icon: 'tag' },
  { id: 'reviews', type: 'product', label: 'Customer Reviews', description: 'Products with strong social proof and ratings', icon: 'star' },
  { id: 'sustainability', type: 'product', label: 'Sustainability & Ethics', description: 'Eco-friendly, ethical manufacturing', icon: 'leaf' },
  { id: 'design', type: 'product', label: 'Design & Aesthetics', description: 'Visually appealing, well-designed products', icon: 'palette' },
  { id: 'shipping', type: 'product', label: 'Shipping & Availability', description: 'Fast shipping, good stock levels', icon: 'truck' },
  { id: 'warranty', type: 'product', label: 'Warranty & Guarantees', description: 'Strong return policies and warranties', icon: 'shield' },
  { id: 'brand_recognition', type: 'product', label: 'Brand Recognition', description: 'Well-known, established brands', icon: 'award' },
];

// Brand priority options
export const BRAND_PRIORITIES: PriorityOption[] = [
  { id: 'commission', type: 'brand', label: 'Commission Rate', description: 'Higher earnings per sale', icon: 'percent' },
  { id: 'customer_service', type: 'brand', label: 'Customer Service', description: 'Brands known for great support', icon: 'headphones' },
  { id: 'return_policy', type: 'brand', label: 'Return Policy', description: 'Easy returns reduce refund complaints', icon: 'refresh-cw' },
  { id: 'reputation', type: 'brand', label: 'Brand Reputation', description: 'Trusted, established brands', icon: 'badge-check' },
  { id: 'brand_sustainability', type: 'brand', label: 'Sustainability & Ethics', description: 'Environmentally conscious companies', icon: 'globe' },
  { id: 'payment_speed', type: 'brand', label: 'Payment Reliability', description: 'Timely, reliable affiliate payments', icon: 'credit-card' },
  { id: 'cookie_duration', type: 'brand', label: 'Cookie Duration', description: 'Longer tracking window = more conversions', icon: 'clock' },
  { id: 'easy_approval', type: 'brand', label: 'Easy Approval', description: 'No lengthy application process', icon: 'check-circle' },
];
