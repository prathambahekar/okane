import React from 'react';
import { Wallet as WalletLucide } from 'lucide-react';

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
    id: 'cash',
    name: 'Cash',
    defaultName: 'Cash in Hand',
    color: '#16A34A',
    bgLight: '#DCFCE7',
    iconKey: 'cash',
  },
];

export function renderWalletIcon(iconKey?: string, size = 26, customColor?: string): React.ReactNode {
  const key = (iconKey || '').toLowerCase();

  // 1. Google Pay - Crisp official Google 4-color 'G' icon on clean white disc
  if (key === 'gpay' || key.includes('google')) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="12" fill="#FFFFFF" />
        <path
          d="M38.5 24.5c0-1.1-.1-2.17-.29-3.2H24v6.06h8.14c-.35 1.89-1.42 3.49-3.03 4.56v3.79h4.9c2.87-2.64 4.49-6.53 4.49-11.21z"
          fill="#4285F4"
        />
        <path
          d="M24 39.25c4.12 0 7.58-1.36 10.11-3.69l-4.9-3.79c-1.37.92-3.12 1.46-5.21 1.46-4.01 0-7.4-2.7-8.61-6.34H10.3v3.91C12.82 35.81 18.01 39.25 24 39.25z"
          fill="#34A853"
        />
        <path
          d="M15.39 26.89c-.31-.92-.49-1.9-.49-2.89s.18-1.97.49-2.89V17.2H10.3A15.21 15.21 0 008.75 24c0 2.46.59 4.79 1.55 6.8l5.09-3.91z"
          fill="#FBBC05"
        />
        <path
          d="M24 14.77c2.24 0 4.25.77 5.83 2.29l4.38-4.38C31.56 10.22 28.11 8.75 24 8.75c-5.99 0-11.18 3.44-13.7 8.45l5.09 3.91c1.21-3.64 4.6-6.34 8.61-6.34z"
          fill="#EA4335"
        />
      </svg>
    );
  }

  // 2. PhonePe - Genuine purple squircle with official 'पे' symbol
  if (key === 'phonepe' || key.includes('phone')) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="12" fill="#5F259F" />
        {/* White circular backdrop inside PhonePe squircle */}
        <circle cx="24" cy="24" r="17" fill="#5F259F" />
        {/* Stylized official Devanagari Pe 'पे' mark */}
        <path
          d="M28.5 12.5H19.5C15.8 12.5 13 15.3 13 19V28C13 31.7 15.8 34.5 19.5 34.5H21V39.5L28.5 34.5H29C32.7 34.5 35.5 31.7 35.5 28V19C35.5 15.3 32.7 12.5 28.5 12.5Z"
          fill="#FFFFFF"
        />
        <path
          d="M21 17.5H26C27.9 17.5 29.5 19.1 29.5 21C29.5 22.9 27.9 24.5 26 24.5H21V17.5Z"
          fill="#5F259F"
        />
        <path
          d="M21 26H25C26.7 26 28 27.3 28 29C28 30.7 26.7 32 25 32H21V26Z"
          fill="#5F259F"
        />
      </svg>
    );
  }

  // 3. Amazon Pay - Official dark badge with amazon smile & pay typography
  if (key === 'amazonpay' || key === 'amazon' || key.includes('amazon')) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="12" fill="#131921" />
        <text
          x="10.5"
          y="23"
          fill="#FFFFFF"
          fontSize="14.5"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="0.3px"
        >
          pay
        </text>
        <path
          d="M10 30.5C18 36.5 30 36.5 37.5 29.5"
          stroke="#FF9900"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M34.5 28L38 29.5L36 33.5"
          stroke="#FF9900"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // 4. Paytm - Official Navy + Cyan branding
  if (key === 'paytm') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="12" fill="#002970" />
        <path
          d="M8 17H18C20.8 17 23 19.2 23 22C23 24.8 20.8 27 18 27H12.5V33H8V17Z"
          fill="#00BAF2"
        />
        <path
          d="M24 21.5H35V25.5H30V33H25.5V25.5H24V21.5Z"
          fill="#FFFFFF"
        />
        <circle cx="37" cy="22" r="2.2" fill="#00BAF2" />
      </svg>
    );
  }

  // 5. Other UPI - Genuine NPCI Unified Payments Interface logo
  if (key === 'other_upi' || key === 'upi' || key.includes('upi')) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="12" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <path d="M14 12L26 24L14 36V12Z" fill="#097939" />
        <path d="M22 12L34 24L22 36V12Z" fill="#ED7524" />
      </svg>
    );
  }

  // 6. Bank Account - Clean architectural facade with pillars and pediment
  if (key === 'bank' || key.includes('bank') || key.includes('account')) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="12" fill="#0D9488" />
        <path d="M24 10L9 18.5V20.5H39V18.5L24 10Z" fill="#FFFFFF" />
        <rect x="10.5" y="21" width="27" height="2" rx="0.5" fill="#FFFFFF" opacity="0.9" />
        <rect x="12.5" y="24" width="3.5" height="10.5" rx="0.8" fill="#FFFFFF" />
        <rect x="19" y="24" width="3.5" height="10.5" rx="0.8" fill="#FFFFFF" />
        <rect x="25.5" y="24" width="3.5" height="10.5" rx="0.8" fill="#FFFFFF" />
        <rect x="32" y="24" width="3.5" height="10.5" rx="0.8" fill="#FFFFFF" />
        <rect x="9" y="35" width="30" height="3" rx="0.8" fill="#FFFFFF" />
      </svg>
    );
  }

  // 7. Cash - Emerald currency banknote
  if (key === 'cash') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="12" fill="#16A34A" />
        <rect
          x="8.5"
          y="13"
          width="31"
          height="22"
          rx="3.5"
          stroke="#FFFFFF"
          strokeWidth="2.4"
        />
        <circle cx="24" cy="24" r="5" stroke="#FFFFFF" strokeWidth="2.2" />
        <path
          d="M22.5 21.5H25.5M22.5 23.5H25.5M22.5 21.5V26.5M25.5 23.5L22.5 26.5"
          stroke="#FFFFFF"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="13.5" cy="24" r="1.8" fill="#FFFFFF" />
        <circle cx="34.5" cy="24" r="1.8" fill="#FFFFFF" />
      </svg>
    );
  }

  return <WalletLucide size={size} color={customColor || '#D97706'} />;
}
