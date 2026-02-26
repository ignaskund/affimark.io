import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

export function TikTokIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.98a8.18 8.18 0 004.76 1.52V7.05a4.84 4.84 0 01-1-.36z" />
    </svg>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

export function YouTubeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function TwitterXIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function AmazonIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M.045 18.02c.072-.116.187-.124.348-.064 2.272 1.307 4.784 1.96 7.536 1.96 2.075 0 4.128-.453 6.156-1.358.148-.063.293-.137.44-.216a.46.46 0 01.199-.048c.16 0 .28.095.36.284-.072.188-.2.344-.384.468a13.1 13.1 0 01-2.536 1.324c-1.72.672-3.512 1.008-5.376 1.008a14.44 14.44 0 01-5.148-.936A14.15 14.15 0 01.045 18.02zm6.132-4.986c0-.76.208-1.416.624-1.968.416-.552.968-.936 1.656-1.152a8.798 8.798 0 011.608-.372c.64-.08 1.3-.136 1.98-.168v-.48c0-.4-.024-.728-.072-.984a1.477 1.477 0 00-.312-.672c-.152-.176-.368-.296-.648-.36a5.2 5.2 0 00-1.044-.096c-.36 0-.768.04-1.224.12a9.3 9.3 0 00-1.32.384.26.26 0 01-.24-.048c-.08-.088-.12-.2-.12-.336v-.4c0-.16.028-.28.084-.36a.548.548 0 01.276-.2 9.8 9.8 0 011.572-.472 8.24 8.24 0 011.62-.168c.776 0 1.416.092 1.92.276.504.184.892.44 1.164.768.272.328.448.72.528 1.176.08.456.12.952.12 1.488v5.448a.488.488 0 01-.072.288.432.432 0 01-.24.168l-.072.024a10.3 10.3 0 01-1.464.608 6.8 6.8 0 01-1.896.264c-.592 0-1.104-.068-1.536-.204a2.84 2.84 0 01-1.08-.612 2.47 2.47 0 01-.636-.996 3.78 3.78 0 01-.204-1.284zm3.432 1.392c.32 0 .664-.052 1.032-.156.368-.104.656-.216.864-.336v-2.28c-.384.008-.804.04-1.26.096a6.3 6.3 0 00-1.14.228 2.05 2.05 0 00-.816.468c-.208.2-.312.472-.312.816 0 .48.128.824.384 1.032.256.208.632.312 1.128.312h.12zm8.64-1.392c0-1.088.288-1.94.864-2.556.576-.616 1.36-.924 2.352-.924.56 0 1.04.096 1.44.288.4.192.72.456.96.792.24.336.412.728.516 1.176.104.448.156.928.156 1.44v.36c0 .096-.04.172-.12.228a.374.374 0 01-.216.072h-4.2v.096c0 .512.148.924.444 1.236.296.312.74.468 1.332.468.408 0 .772-.056 1.092-.168.32-.112.592-.232.816-.36a.334.334 0 01.168-.048c.12 0 .2.076.24.228v.384c0 .12-.02.216-.06.288a.484.484 0 01-.204.192 4.66 4.66 0 01-1.02.444c-.4.128-.86.192-1.38.192-1.04 0-1.852-.3-2.436-.9-.584-.6-.876-1.464-.876-2.592v-.336zm1.8-.648h2.808v-.048c0-.48-.116-.88-.348-1.2-.232-.32-.58-.48-1.044-.48-.464 0-.82.16-1.068.48-.248.32-.372.72-.372 1.2v.048h.024z" />
      <path d="M21.48 19.788c.24-.204.48-.324.72-.36.24-.036.4.06.48.288.072.188.016.36-.168.516l-.12.096c-.824.664-1.712 1.012-2.664 1.044-.96.032-1.472-.448-1.536-1.44-.032-.472.04-.952.216-1.44a4.3 4.3 0 01.792-1.32c.248-.284.48-.372.696-.264.12.068.188.2.204.396.008.08-.004.172-.036.276l-.06.192c-.16.484-.232.924-.216 1.32.016.396.22.588.612.576.44-.024.868-.2 1.284-.528z" />
    </svg>
  );
}

export function LTKIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.5 14.5H8V7.5h2.5v9zm5 0H13V7.5h2.5v6l2.5-6h2.5l-2.75 5.25L20.5 18h-2.75l-2.25-4.5v4.5z" />
    </svg>
  );
}

export function ShopMyIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 2.5c1.93 0 3.5 1.57 3.5 3.5S13.93 13.5 12 13.5 8.5 11.93 8.5 10 10.07 6.5 12 6.5zm6 11H6v-.75c0-2 4-3.1 6-3.1s6 1.1 6 3.1v.75z" />
    </svg>
  );
}

export function AwinIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M4.5 4L1 20h3.5l1.75-8L8 20h3L7.5 4h-3zm8 0L9 20h3.5l1.75-8L16 20h3l-3.5-16h-3zm8 0L17 20h3.5L22.25 12 24 20h0l-3.5-16h-1z" />
    </svg>
  );
}

export function TradedoublerIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 3a2.5 2.5 0 110 5 2.5 2.5 0 010-5zm-4 9.5a2 2 0 114 0 2 2 0 01-4 0zm8 0a2 2 0 114 0 2 2 0 01-4 0z" />
    </svg>
  );
}

export function ShopStyleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeWidth="1.5" stroke="currentColor" fill="none" />
    </svg>
  );
}

export function LinktreeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M7.953 15.066l-.038-4.01 4.06-.004.004-3.02-4.06.003L12.012 4l-1.97-1.96-4.06 4.06L1.94 2.06 0 4.02l4.05 4.04L0 12.11l1.96 1.96 4.04-4.05v4.04l1.953.007zm8.14-11.03l-4.06 4.06L7.97 4.02l1.962-1.96 4.06 4.036 4.04-4.04 1.96 1.96-4.04 4.04 4.04 4.05-1.96 1.96-4.04-4.04v7.12h-2.77V8.06z" />
    </svg>
  );
}

const PLATFORM_ICON_MAP: Record<string, React.ComponentType<IconProps>> = {
  youtube: YouTubeIcon,
  instagram: InstagramIcon,
  twitter: TwitterXIcon,
  tiktok: TikTokIcon,
  amazon: AmazonIcon,
  amazon_de: AmazonIcon,
  amazon_uk: AmazonIcon,
  amazon_us: AmazonIcon,
  amazon_fr: AmazonIcon,
  amazon_es: AmazonIcon,
  amazon_it: AmazonIcon,
  ltk: LTKIcon,
  shopmy: ShopMyIcon,
  awin: AwinIcon,
  tradedoubler: TradedoublerIcon,
  shopstyle: ShopStyleIcon,
  linktree: LinktreeIcon,
};

export function getPlatformIcon(
  platformKey: string
): React.ComponentType<IconProps> {
  const base = platformKey.toLowerCase().split('_')[0];
  return PLATFORM_ICON_MAP[platformKey.toLowerCase()] || PLATFORM_ICON_MAP[base] || ShopMyIcon;
}

export const PLATFORM_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  youtube: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400' },
  instagram: { bg: 'bg-pink-500/20', border: 'border-pink-500/30', text: 'text-pink-400' },
  twitter: { bg: 'bg-sky-500/20', border: 'border-sky-500/30', text: 'text-sky-400' },
  tiktok: { bg: 'bg-fuchsia-500/20', border: 'border-fuchsia-500/30', text: 'text-fuchsia-400' },
  amazon: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400' },
  ltk: { bg: 'bg-rose-500/20', border: 'border-rose-500/30', text: 'text-rose-400' },
  shopmy: { bg: 'bg-violet-500/20', border: 'border-violet-500/30', text: 'text-violet-400' },
  awin: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400' },
  tradedoubler: { bg: 'bg-lime-500/20', border: 'border-lime-500/30', text: 'text-lime-400' },
  shopstyle: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', text: 'text-indigo-400' },
};

export function getPlatformColor(platformKey: string) {
  const base = platformKey.toLowerCase().split('_')[0];
  return (
    PLATFORM_COLORS[platformKey.toLowerCase()] ||
    PLATFORM_COLORS[base] ||
    { bg: 'bg-gray-500/20', border: 'border-gray-500/30', text: 'text-gray-400' }
  );
}
