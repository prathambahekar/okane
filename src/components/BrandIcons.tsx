import React from 'react';

export interface SubscriptionPreset {
  id: string;
  name: string;
  color: string;
  category: string;
  defaultAmount?: number;
  billingCycle: 'monthly' | 'yearly';
  logoKey: string;
}

export const POPULAR_SUBSCRIPTIONS: SubscriptionPreset[] = [
  { id: 'netflix', name: 'Netflix', color: '#E50914', category: 'Entertainment', defaultAmount: 649, billingCycle: 'monthly', logoKey: 'netflix' },
  { id: 'prime', name: 'Prime Video', color: '#00A8E1', category: 'Entertainment', defaultAmount: 1499, billingCycle: 'yearly', logoKey: 'prime' },
  { id: 'hotstar', name: 'Disney+ Hotstar', color: '#001438', category: 'Entertainment', defaultAmount: 299, billingCycle: 'monthly', logoKey: 'hotstar' },
  { id: 'spotify', name: 'Spotify', color: '#1DB954', category: 'Music', defaultAmount: 119, billingCycle: 'monthly', logoKey: 'spotify' },
  { id: 'youtube', name: 'YouTube Premium', color: '#FF0000', category: 'Entertainment', defaultAmount: 149, billingCycle: 'monthly', logoKey: 'youtube' },
  { id: 'apple', name: 'Apple Music / TV+', color: '#1D1D1F', category: 'Entertainment', defaultAmount: 99, billingCycle: 'monthly', logoKey: 'apple' },
  { id: 'chatgpt', name: 'ChatGPT Plus', color: '#10A37F', category: 'Utilities', defaultAmount: 1999, billingCycle: 'monthly', logoKey: 'chatgpt' },
  { id: 'notion', name: 'Notion Plus', color: '#111111', category: 'Work', defaultAmount: 800, billingCycle: 'monthly', logoKey: 'notion' },
  { id: 'playstation', name: 'PlayStation Plus', color: '#00439C', category: 'Gaming', defaultAmount: 499, billingCycle: 'monthly', logoKey: 'playstation' },
  { id: 'xbox', name: 'Xbox Game Pass', color: '#107C41', category: 'Gaming', defaultAmount: 549, billingCycle: 'monthly', logoKey: 'xbox' },
  { id: 'gym', name: 'Gym / Cult.fit', color: '#FF3278', category: 'Health', defaultAmount: 1500, billingCycle: 'monthly', logoKey: 'gym' },
];

const brandSvgProps = {
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  preserveAspectRatio: 'xMidYMid meet',
  shapeRendering: 'geometricPrecision' as const,
  style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 },
};

export function renderBrandLogo(logoKey: string, size = 20): React.ReactNode {
  const key = logoKey.toLowerCase();

  if (key.includes('netflix')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...brandSvgProps}>
        <path d="M5.5 2V22L10.5 12V22L18.5 21.5V2L13.5 12V2H5.5Z" fill="#E50914" />
        <path d="M5.5 2L13.5 22H18.5L10.5 2H5.5Z" fill="#B81D24" />
      </svg>
    );
  }

  if (key.includes('prime') || key.includes('amazon')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...brandSvgProps}>
        <path d="M3 17.5C7 20 15 20.5 21 16" stroke="#00A8E1" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M18.5 14.5L21.5 16.5L19 19.5" stroke="#00A8E1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Crisp vector 'p' badge for Prime */}
        <path d="M4 6h4.5c2.2 0 3.5 1.2 3.5 3s-1.3 3-3.5 3H6.5v3.5H4V6zm2.5 4h1.8c.8 0 1.2-.4 1.2-1s-.4-1-1.2-1H6.5v2z" fill="#00A8E1" />
      </svg>
    );
  }

  if (key.includes('hotstar') || key.includes('disney')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L14.8 8.6L22 9.2L16.5 13.9L18.2 21L12 17.3L5.8 21L7.5 13.9L2 9.2L9.2 8.6L12 2Z" fill="#38BDF8" />
      </svg>
    );
  }

  if (key.includes('spotify')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#1DB954" />
        <path d="M6.5 9.5C11 8.2 16 9 18 10.2" stroke="#000000" strokeWidth="2" strokeLinecap="round" />
        <path d="M7.5 12.5C11 11.5 15 12.2 16.8 13.2" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8.5 15.5C11.2 14.8 14 15.3 15.5 16.1" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (key.includes('youtube')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="5" width="20" height="14" rx="4" fill="#FF0000" />
        <polygon points="10,8 16,12 10,16" fill="#FFFFFF" />
      </svg>
    );
  }

  if (key.includes('apple') || key.includes('icloud')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...brandSvgProps}>
        <path d="M18.7 17.1C17.8 18.4 16.8 19.8 15.3 19.8C13.9 19.8 13.4 18.9 11.8 18.9C10.2 18.9 9.7 19.8 8.3 19.8C6.8 19.8 5.7 18.2 4.8 16.9C3 14.3 1.6 9.6 3.5 6.3C4.4 4.7 6 3.7 7.7 3.7C9.2 3.7 10.1 4.7 11.3 4.7C12.4 4.7 13.1 3.7 14.8 3.7C16.3 3.7 17.7 4.5 18.6 5.8C15.3 7.8 15.8 12.6 18.9 13.9C18.2 15.2 17.5 16.3 18.7 17.1ZM14.3 3.6C15 2.7 15.5 1.5 15.3 0.2C14.2 0.3 12.8 1 12.1 1.9C11.5 2.6 11 3.9 11.2 5.1C12.5 5.2 13.7 4.4 14.3 3.6Z" fill="currentColor" />
      </svg>
    );
  }

  if (key.includes('chatgpt') || key.includes('openai')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 11C20 6.6 16.4 3 12 3C7.6 3 4 6.6 4 11C4 13.2 4.9 15.2 6.3 16.7L5 21L9.6 19.5C10.4 19.8 11.2 20 12 20C16.4 20 20 16.4 20 11Z" fill="#10A37F" opacity="0.2" />
        <circle cx="12" cy="12" r="7" stroke="#10A37F" strokeWidth="2.2" />
        <circle cx="12" cy="12" r="3" fill="#10A37F" />
      </svg>
    );
  }

  if (key.includes('canva')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#00C4CC" />
        <path d="M15 9C13 7.5 9 8 8 11.5C7 15 11 16.5 15 15" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (key.includes('notion')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="4" width="16" height="16" rx="3" fill="#FFFFFF" />
        <path d="M7 7L10 7L14 13V7H17V17H14L10 11V17H7V7Z" fill="#000000" />
      </svg>
    );
  }

  if (key.includes('playstation') || key.includes('ps5') || key.includes('ps4')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 4V16L12 18V2L8 4Z" fill="#00439C" />
        <path d="M12 8L18 6V10L12 12V8Z" fill="#0070D1" />
        <path d="M6 15C8 13.5 14 13.5 18 16C19 16.5 19 18 17 18.5C13 19.5 7 19.5 5 18C4 17.2 4.5 16 6 15Z" fill="#00A0E9" />
      </svg>
    );
  }

  if (key.includes('xbox')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#107C41" />
        <path d="M6 7C8.5 9.5 11 13 12 15C13 13 15.5 9.5 18 7C15 5 9 5 6 7Z" fill="#FFFFFF" />
        <path d="M5 16C7 13.5 10 11 12 15C14 11 17 13.5 19 16C16 19 8 19 5 16Z" fill="#FFFFFF" />
      </svg>
    );
  }

  if (key.includes('gym') || key.includes('cult') || key.includes('fitness')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="10" width="3" height="4" rx="1" fill="#FF3278" />
        <rect x="18" y="10" width="3" height="4" rx="1" fill="#FF3278" />
        <rect x="6" y="8" width="3" height="8" rx="1" fill="#FF3278" />
        <rect x="15" y="8" width="3" height="8" rx="1" fill="#FF3278" />
        <rect x="8" y="11" width="8" height="2" fill="#FF3278" />
      </svg>
    );
  }

  return null;
}

export function detectBrandPreset(name: string): SubscriptionPreset | undefined {
  if (!name) return undefined;
  const n = name.toLowerCase().trim();
  return POPULAR_SUBSCRIPTIONS.find(sub => {
    const sName = sub.name.toLowerCase();
    const sKey = sub.logoKey.toLowerCase();
    return n.includes(sKey) || n.includes(sName.split(' ')[0]);
  });
}
