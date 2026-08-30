import React from 'react';

export interface WalletTypePreset {
  id: string;
  name: string;
  defaultName: string;
  color: string;
  bgLight: string;
  iconKey: string;
}

export const WALLET_PRESETS: WalletTypePreset[] = [
  {
    id: 'gpay',
    name: 'Google Pay',
    defaultName: 'Google Pay',
    color: '#4285F4',
    bgLight: '#EEF4FF',
    iconKey: 'gpay',
  },
  {
    id: 'phonepe',
    name: 'PhonePe',
    defaultName: 'PhonePe',
    color: '#5F259F',
    bgLight: '#F3E8FF',
    iconKey: 'phonepe',
  },
  {
    id: 'amazonpay',
    name: 'Amazon Pay',
    defaultName: 'Amazon Pay',
    color: '#FF9900',
    bgLight: '#FFF8E7',
    iconKey: 'amazonpay',
  },
  {
    id: 'paytm',
    name: 'Paytm',
    defaultName: 'Paytm',
    color: '#00BAF2',
    bgLight: '#E0F7FE',
    iconKey: 'paytm',
  },
  {
    id: 'other_upi',
    name: 'Other UPI',
    defaultName: 'UPI Account',
    color: '#097939',
    bgLight: '#E8F5E9',
    iconKey: 'other_upi',
  },
  {
    id: 'bank',
    name: 'Bank Account',
    defaultName: 'Bank Account',
    color: '#0D9488',
    bgLight: '#CCFBF1',
    iconKey: 'bank',
  },
  {
    id: 'card',
    name: 'Cards / Debit',
    defaultName: 'Card / Debit',
    color: '#6366F1',
    bgLight: '#EEF2FF',
    iconKey: 'card',
  },
  {
    id: 'cash',
    name: 'Cash',
    defaultName: 'Cash',
    color: '#EAB308',
    bgLight: '#FEF9C3',
    iconKey: 'cash',
  },
];

const svgCommonProps = {
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  preserveAspectRatio: 'xMidYMid meet',
  shapeRendering: 'geometricPrecision' as const,
  style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 },
};

export function renderWalletIcon(iconKey?: string, size = 26, customColor?: string): React.ReactNode {
  const key = (iconKey || '').toLowerCase().trim();

  // 1. Google Pay - Crisp Google G on Adaptive Light/Dark Squircle
  if (key === 'gpay' || key.includes('google') || key.includes('gpay')) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" {...svgCommonProps}>
        <rect width="48" height="48" rx="12" className="wallet-icon-gpay-bg" />
        <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="11.25" className="wallet-icon-gpay-border" strokeWidth="1.5" />
        <path
          d="M37.5 24.32c0-1.16-.1-2.28-.3-3.32H24v6.28h7.58c-.33 1.77-1.33 3.26-2.83 4.27v3.55h4.58c2.68-2.47 4.17-6.11 4.17-10.78z"
          fill="#4285F4"
        />
        <path
          d="M24 38c3.78 0 6.95-1.25 9.27-3.4l-4.58-3.55c-1.28.86-2.92 1.37-4.69 1.37-3.61 0-6.67-2.44-7.76-5.72H11.4v3.66C13.72 34.98 18.53 38 24 38z"
          fill="#34A853"
        />
        <path
          d="M16.24 26.7c-.28-.85-.44-1.76-.44-2.7s.16-1.85.44-2.7V17.64H11.4A14.93 14.93 0 0010 24c0 2.41.58 4.69 1.6 6.7l4.64-3.66v-.34z"
          fill="#FBBC05"
        />
        <path
          d="M24 16.58c2.06 0 3.9.71 5.35 2.1l4.01-4.01C30.93 12.41 27.76 11 24 11c-5.47 0-10.28 3.02-12.6 7.64l4.84 3.7c1.09-3.28 4.15-5.76 7.76-5.76z"
          fill="#EA4335"
        />
      </svg>
    );
  }

  // 2. PhonePe - Official PhonePe Royal Purple Squircle with Authentic White 'पे' Brand Glyph
  if (key === 'phonepe' || key.includes('phonepe') || key.includes('phone')) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" {...svgCommonProps}>
        <rect width="48" height="48" rx="12" className="wallet-icon-phonepe-bg" />
        <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="11.25" className="wallet-icon-phonepe-border" strokeWidth="1.5" />
        <g transform="translate(6, 6) scale(1.5)">
          <path
            d="M10.206 9.941h2.949v4.692c-.402.201-.938.268-1.34.268c-1.072 0-1.609-.536-1.609-1.743V9.941zm13.47 4.816c-1.523 6.449-7.985 10.442-14.433 8.919C2.794 22.154-1.199 15.691.324 9.243C1.847 2.794 8.309-1.199 14.757.324c6.449 1.523 10.442 7.985 8.919 14.433zm-6.231-5.888a.887.887 0 0 0-.871-.871h-1.609l-3.686-4.222c-.335-.402-.871-.536-1.407-.402l-1.274.401c-.201.067-.268.335-.134.469l4.021 3.82H6.386c-.201 0-.335.134-.335.335v.67c0 .469.402.871.871.871h.938v3.217c0 2.413 1.273 3.82 3.418 3.82.67 0 1.206-.067 1.877-.335v2.145c0 .603.469 1.072 1.072 1.072h.938a.432.432 0 0 0 .402-.402V9.874h1.542c.201 0 .335-.134.335-.335v-.67z"
            fill="#FFFFFF"
          />
        </g>
      </svg>
    );
  }

  // 3. Amazon Pay - Official Amazon Icon (Adaptive Squircle + Smile)
  if (key === 'amazonpay' || key === 'amazon' || key.includes('amazon')) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" {...svgCommonProps}>
        <rect width="48" height="48" rx="12" className="wallet-icon-amazon-bg" />
        <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="11.25" className="wallet-icon-amazon-border" strokeWidth="1.5" />
        <g transform="translate(9, 7) scale(0.068)">
          {/* Amazon 'a' */}
          <path
            d="M257.2 162.7c-48.7 1.8-169.5 15.5-169.5 117.5c0 109.5 138.3 114 183.5 43.2c6.5 10.2 35.4 37.5 45.3 46.8l56.8-56S341 288.9 341 261.4V114.3C341 89 316.5 32 228.7 32C140.7 32 94 87 94 136.3l73.5 6.8c16.3-49.5 54.2-49.5 54.2-49.5c40.7-.1 35.5 29.8 35.5 69.1m0 86.8c0 80-84.2 68-84.2 17.2c0-47.2 50.5-56.7 84.2-57.8z"
            className="wallet-icon-amazon-glyph"
          />
          {/* Amazon Orange Smile Arc */}
          <path
            d="M393.2 413c-7.7 10-70 67-174.5 67S34.2 408.5 9.7 379c-6.8-7.7 1-11.3 5.5-8.3C88.5 415.2 203 488.5 387.7 401c7.5-3.7 13.3 2 5.5 12"
            fill="#FF9900"
          />
          {/* Amazon Smile Arrowhead with Dimple */}
          <path
            d="m433 415.2c-6.5 15.8-16 26.8-21.2 31c-5.5 4.5-9.5 2.7-6.5-3.8s19.3-46.5 12.7-55c-6.5-8.3-37-4.3-48-3.2c-10.8 1-13 2-14-.3c-2.3-5.7 21.7-15.5 37.5-17.5c15.7-1.8 41-.8 46 5.7c3.7 5.1 0 27.1-6.5 43.1"
            fill="#FF9900"
          />
        </g>
      </svg>
    );
  }

  // 4. Paytm - Sleek Official Paytm Adaptive Squircle with 'Pay' & Bright Cyan 'tm'
  if (key === 'paytm' || key.includes('paytm')) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" {...svgCommonProps}>
        <rect width="48" height="48" rx="12" className="wallet-icon-paytm-bg" />
        <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="11.25" className="wallet-icon-paytm-border" strokeWidth="1.5" />
        {/* Centered Paytm Vector Brand Mark */}
        <g transform="translate(6, 17) scale(0.29)">
          {/* 'Pay' */}
          <g className="wallet-icon-paytm-pay">
            {/* P */}
            <path d="M4 6h16c8.5 0 13.5 4.5 13.5 11s-5 11-13.5 11H12.5v13H4V6zm8.5 15h6.5c3.5 0 5.5-1.8 5.5-4.5s-2-4.5-5.5-4.5h-6.5V21z" />
            {/* a */}
            <path d="M46 19.5c6.5 0 9.5 3 9.5 8v13.5h-7.5v-2.8c-1.8 2-4.2 3.2-7 3.2-4.8 0-8-3-8-7.2 0-4.8 3.8-7.2 9.5-7.2h5.5v-.5c0-1.8-1.2-3-4-3-2.2 0-4.5.8-6.5 1.8l-2.5-5.5c3.2-1.8 7.2-3.3 11-3.3zm.8 13.5h-3.8c-2.2 0-3.5.8-3.5 2.2s1.2 2.2 3.5 2.2c2.8 0 3.8-1.2 3.8-3.2v-1.2z" />
            {/* y */}
            <path d="M57.5 20.5h8.5l4 12.5 4-12.5h8.5l-8.5 20.5c-2.2 5.2-5 7-10 7-1.2 0-2.5-.2-3.5-.5l.8-6c.8.2 1.5.3 2.2.3 2 0 3-.8 3.8-3l-9.8-17.8z" />
          </g>
          {/* 'tm' in Official Electric Cyan */}
          <g className="wallet-icon-paytm-tm">
            {/* t */}
            <path d="M85 12.5v7h-3.8v5.5H85v10c0 4 2 6 6 6 1.2 0 2.5-.2 3.5-.6l-.8-5.2c-.6.2-1.2.3-1.8.3-1.2 0-1.8-.6-1.8-1.8V25h4.2v-5.5h-4.2v-7H85z" />
            {/* m */}
            <path d="M96 20.5h6.5v2.8c1.5-2.2 3.8-3.2 6.5-3.2 2.8 0 4.5 1.2 5.5 3.2 1.8-2.2 4.2-3.2 7-3.2 4 0 6.5 2.8 6.5 7.8v13.4h-6.8V28.5c0-2.2-1-3.2-2.8-3.2-1.8 0-3 1.2-3.5 3v13H108V28.5c0-2.2-1-3.2-2.8-3.2-1.8 0-3 1.2-3.5 3v13H96V20.5z" />
          </g>
        </g>
      </svg>
    );
  }

  // 5. Other UPI / NPCI UPI - Authentic NPCI Green & Orange Chevron Logo with High-Definition Geometry
  if (key === 'other_upi' || key === 'upi' || key.includes('upi') || key.includes('bhim')) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" {...svgCommonProps}>
        <rect width="48" height="48" rx="12" className="wallet-icon-upi-bg" />
        <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="11.25" className="wallet-icon-upi-border" strokeWidth="1.5" />
        <g transform="translate(2, 0)">
          {/* NPCI Green Left Chevron */}
          <path
            d="M10 12.5L22.5 24L10 35.5H16.8L29.3 24L16.8 12.5H10Z"
            className="wallet-icon-upi-chevron-g"
          />
          {/* NPCI Orange Right Chevron */}
          <path
            d="M20 12.5L32.5 24L20 35.5H26.8L39.3 24L26.8 12.5H20Z"
            className="wallet-icon-upi-chevron-o"
          />
        </g>
      </svg>
    );
  }

  // 6. Bank Account - Sophisticated Architectural Classical Bank with 4 Pillars & Crest
  if (key === 'bank' || key.includes('bank') || key.includes('account')) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" {...svgCommonProps}>
        <defs>
          <linearGradient id="bankRoofGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="12" className="wallet-icon-bank-bg" />
        <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="11.25" className="wallet-icon-bank-border" strokeWidth="1.5" />
        {/* Triangular Pediment / Gable Roof with Overhang */}
        <path d="M24 10.5L8.5 19H39.5L24 10.5Z" fill="url(#bankRoofGrad)" />
        {/* Golden Central Seal Medallion */}
        <circle cx="24" cy="16" r="2.2" fill="#F59E0B" />
        {/* Architrave / Cornice Beams */}
        <rect x="9.5" y="19.5" width="29" height="1.8" rx="0.5" fill="#FFFFFF" opacity="0.95" />
        <rect x="10.5" y="21.8" width="27" height="1.2" rx="0.4" fill="#FFFFFF" opacity="0.8" />
        {/* Recessed Central Portal Archway */}
        <path d="M21.5 25.5C21.5 24.1 22.6 23 24 23C25.4 23 26.5 24.1 26.5 25.5V34H21.5V25.5Z" fill="#000000" opacity="0.22" />
        {/* 4 Corinthian/Ionic Columns with Capitols & Bases */}
        <g fill="#FFFFFF">
          {/* Pillar 1 */}
          <rect x="11.5" y="23.5" width="3.8" height="10.5" rx="0.8" />
          <rect x="10.8" y="23" width="5.2" height="1.2" rx="0.4" opacity="0.9" />
          <rect x="10.8" y="33" width="5.2" height="1.2" rx="0.4" opacity="0.9" />
          {/* Pillar 2 */}
          <rect x="17.8" y="23.5" width="3.8" height="10.5" rx="0.8" />
          <rect x="17.1" y="23" width="5.2" height="1.2" rx="0.4" opacity="0.9" />
          <rect x="17.1" y="33" width="5.2" height="1.2" rx="0.4" opacity="0.9" />
          {/* Pillar 3 */}
          <rect x="26.4" y="23.5" width="3.8" height="10.5" rx="0.8" />
          <rect x="25.7" y="23" width="5.2" height="1.2" rx="0.4" opacity="0.9" />
          <rect x="25.7" y="33" width="5.2" height="1.2" rx="0.4" opacity="0.9" />
          {/* Pillar 4 */}
          <rect x="32.7" y="23.5" width="3.8" height="10.5" rx="0.8" />
          <rect x="32" y="23" width="5.2" height="1.2" rx="0.4" opacity="0.9" />
          <rect x="32" y="33" width="5.2" height="1.2" rx="0.4" opacity="0.9" />
        </g>
        {/* 2-tier Stepped Plinth Base */}
        <rect x="9.5" y="34.5" width="29" height="2" rx="0.6" fill="#FFFFFF" opacity="0.9" />
        <rect x="8" y="37" width="32" height="2.5" rx="0.8" fill="#FFFFFF" />
      </svg>
    );
  }

  // 7. Cards / Debit / Credit Card - Minimal clean card badge
  if (key === 'card' || key.includes('card') || key.includes('debit') || key.includes('credit')) {
    const cardColor = (customColor && customColor !== '#ffffff') ? customColor : '#6366F1';
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" {...svgCommonProps}>
        <rect width="48" height="48" rx="12" className="wallet-icon-card-bg" />
        <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="11.25" className="wallet-icon-card-border" strokeWidth="1.5" />
        <g stroke={cardColor} fill="none">
          {/* Outer credit card rectangle */}
          <rect x="9.5" y="14" width="29" height="20" rx="4.5" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          {/* Top magnetic stripe line */}
          <line x1="9.5" y1="21" x2="38.5" y2="21" strokeWidth="2.5" strokeLinecap="round" />
          {/* Minimal chip/contact circle in lower right */}
          <circle cx="31.5" cy="27" r="2.5" fill={cardColor} stroke="none" />
        </g>
      </svg>
    );
  }

  // 8. Cash - Minimal clean cash banknote badge with yellow icon & neutral white/dark bg
  if (key === 'cash' || key.includes('cash')) {
    const cashYellow = '#EAB308'; // Bright warm yellow
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" {...svgCommonProps}>
        <rect width="48" height="48" rx="12" className="wallet-icon-cash-bg" />
        <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="11.25" className="wallet-icon-cash-border" strokeWidth="1.5" />
        <g stroke={cashYellow} fill="none">
          {/* Outer banknote rectangle */}
          <rect x="9" y="14.5" width="30" height="19" rx="4.5" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          {/* Central circle emblem */}
          <circle cx="24" cy="24" r="3.8" fill={cashYellow} stroke="none" />
          {/* Inner side dashes */}
          <line x1="15" y1="18.5" x2="15" y2="29.5" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
          <line x1="33" y1="18.5" x2="33" y2="29.5" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
        </g>
      </svg>
    );
  }

  // 9. CRED - Adaptive Portal Badge
  if (key === 'cred' || key.includes('cred')) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" {...svgCommonProps}>
        <rect width="48" height="48" rx="12" className="wallet-icon-cred-bg" />
        <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="11.25" className="wallet-icon-cred-border" strokeWidth="1.5" />
        <path
          d="M15 15H33V30C33 34.4 29.4 38 25 38H15V15Z"
          className="wallet-icon-cred-glyph"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M21 21H27V29C27 30.7 25.7 32 24 32H21V21Z"
          className="wallet-icon-cred-glyph"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }

  // 10. Apple Pay - Crisp Apple Pay Icon with Adaptive Light/Dark Squircle
  if (key === 'applepay' || key.includes('apple')) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" {...svgCommonProps}>
        <rect width="48" height="48" rx="12" className="wallet-icon-apple-bg" />
        <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="11.25" className="wallet-icon-apple-border" strokeWidth="1.5" />
        {/* Apple Logo Silhouette */}
        <path
          d="M20.1 23.9c0-2.8 2.3-4.2 2.4-4.3-1.3-1.9-3.4-2.2-4.1-2.2-1.7-.2-3.4 1-4.3 1-.9 0-2.2-1-3.7-1-1.9 0-3.7 1.1-4.7 2.8-2 3.4-.5 8.5 1.4 11.3 1 1.4 2.1 2.9 3.6 2.8 1.5-.1 2.1-.9 3.9-.9 1.8 0 2.3.9 3.9.9 1.6 0 2.6-1.4 3.5-2.8 1.1-1.6 1.6-3.2 1.6-3.3-.1 0-3.5-1.3-3.5-4.3z"
          className="wallet-icon-apple-glyph"
        />
        <path
          d="M17.6 15.6c.8-1 1.3-2.3 1.1-3.6-1.1.1-2.4.7-3.2 1.7-.7.8-1.3 2.2-1.1 3.5 1.2.1 2.4-.6 3.2-1.6z"
          className="wallet-icon-apple-glyph"
        />
        {/* Vector 'Pay' Text */}
        <g className="wallet-icon-apple-glyph">
          <path d="M26 19.5h3.6c1.6 0 2.7.9 2.7 2.3s-1.1 2.3-2.7 2.3H28v3.9H26v-8.5zm2 3.1h1.4c.6 0 1-.3 1-.8s-.4-.8-1-.8H28v1.6z" />
          <path d="M33.8 22.3c1.2 0 1.9.6 1.9 1.7v4h-1.6v-.6c-.3.4-.9.7-1.5.7-1 0-1.7-.6-1.7-1.5 0-1 .8-1.5 2.1-1.5h1.1v-.1c0-.4-.3-.7-.9-.7-.5 0-.9.2-1.3.4l-.5-1.2c.6-.5 1.4-.8 2-.8zm.3 3.1h-.9c-.6 0-.9.2-.9.6s.3.6.8.6.9-.3.9-.9v-.3z" />
          <path d="M36.7 22.5h1.9l1.1 3.4 1.1-3.4h1.9l-2.2 5.5c-.5 1.3-1.2 1.8-2.5 1.8-.3 0-.6 0-.9-.1l.2-1.4c.2 0 .4.1.6.1.6 0 .9-.2 1.1-.9l-2.3-4.5z" />
        </g>
      </svg>
    );
  }

  const iconColor = (customColor && customColor !== '#D97706' && customColor !== '#d97706') ? customColor : 'var(--accent)';

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" {...svgCommonProps}>
      <rect width="48" height="48" rx="12" fill={iconColor} />
      <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="11.25" className="wallet-icon-fallback-border" strokeWidth="1.5" />
      <g transform="translate(11, 11)" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <rect x="2" y="5" width="22" height="16" rx="3" />
        <path d="M2 10h22" />
        <circle cx="17.5" cy="15" r="1.5" fill="#FFFFFF" />
      </g>
    </svg>
  );
}


