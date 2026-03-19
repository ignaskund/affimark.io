import { ShoppingBag, Globe, Package } from 'lucide-react';
import type { ComponentType } from 'react';

const PLATFORM_ICONS: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  amazon: ShoppingBag,
  ltk: Package,
  shopmy: Package,
  awin: Globe,
};

const PLATFORM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  amazon: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  ltk: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' },
  shopmy: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  awin: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
};

const DEFAULT_ICON = Globe;
const DEFAULT_COLORS = { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' };

export function getPlatformIcon(platform: string): ComponentType<{ size?: number; className?: string }> {
  const key = platform.toLowerCase().replace(/[^a-z]/g, '');
  return PLATFORM_ICONS[key] || DEFAULT_ICON;
}

export function getPlatformColor(platform: string): { bg: string; text: string; border: string } {
  const key = platform.toLowerCase().replace(/[^a-z]/g, '');
  return PLATFORM_COLORS[key] || DEFAULT_COLORS;
}
