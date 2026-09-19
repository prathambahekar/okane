import React from 'react';
import type { ContactType } from '../types';

/**
 * Curated palette for consistent user and contact avatars.
 * Includes vibrant, accessible colors tested in both light and dark modes.
 */
export const AVATAR_PALETTE: readonly string[] = [
  '#4F46E5', // Indigo
  '#059669', // Emerald
  '#D97706', // Amber / Warm Orange
  '#2563EB', // Blue
  '#7C3AED', // Violet
  '#E11D48', // Rose
  '#0D9488', // Teal
  '#0284C7', // Sky
  '#8B5CF6', // Purple
  '#F59E0B', // Bright Amber
  '#10B981', // Mint Emerald
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#6366F1', // Royal Indigo
  '#3B82F6', // Cerulean
  '#14B8A6', // Soft Teal
];

/**
 * Deterministic string-to-integer hashing algorithm (djb2 variant).
 * Guarantees that the same user/friend ID will always produce the exact same integer.
 */
export function hashStringToNumber(str: string): number {
  if (!str) return 0;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Returns a consistent avatar color for any given user ID, contact object, or identifier.
 * If an explicit custom color is assigned, it respects it. Otherwise, deterministically maps the ID to a palette color.
 */
export function getConsistentAvatarColor(
  identifierOrContact?: string | { id?: string; name?: string; color?: string; type?: ContactType } | null,
  fallbackColor?: string
): string {
  if (!identifierOrContact) {
    return fallbackColor || AVATAR_PALETTE[0];
  }

  // If passed an object
  if (typeof identifierOrContact === 'object') {
    const { id, name, color, type } = identifierOrContact;

    // Check if custom color is explicitly defined and non-empty
    if (color && color.trim() && color !== 'undefined' && color !== 'null') {
      return color.trim();
    }

    // Default fallbacks for specific contact types if no ID
    if (type === 'vendor' && !id && !name) return '#f59e0b';
    if (type === 'subscription' && !id && !name) return '#8b5cf6';

    const seed = (id && id.trim()) || (name && name.trim()) || '';
    if (seed) {
      const idx = hashStringToNumber(seed) % AVATAR_PALETTE.length;
      return AVATAR_PALETTE[idx];
    }

    return fallbackColor || (type === 'vendor' ? '#f59e0b' : type === 'subscription' ? '#8b5cf6' : AVATAR_PALETTE[0]);
  }

  // If passed a string ID or name directly
  const str = identifierOrContact.trim();
  if (!str) return fallbackColor || AVATAR_PALETTE[0];

  // If it's already a valid hex code or CSS var, return it directly
  if (str.startsWith('#') || str.startsWith('var(') || str.startsWith('rgb')) {
    return str;
  }

  const idx = hashStringToNumber(str) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}

/**
 * Formats a friend's initial or 2-digit number badge consistently.
 */
export function friendInitial(
  nameOrFriend?: string | { name?: string; avatarNumber?: string },
  avatarNumber?: string
): string {
  if (!nameOrFriend) return '?';
  if (typeof nameOrFriend === 'object') {
    if (nameOrFriend.avatarNumber && nameOrFriend.avatarNumber.trim()) {
      return nameOrFriend.avatarNumber.trim();
    }
    return (nameOrFriend.name || '?').trim().charAt(0).toUpperCase();
  }
  if (avatarNumber && avatarNumber.trim()) {
    return avatarNumber.trim();
  }
  return nameOrFriend.trim().charAt(0).toUpperCase();
}

/**
 * Generates consistent CSS styles (background tint, text color, and border) for an avatar color.
 */
export function getAvatarStyle(color?: string): React.CSSProperties {
  if (!color) {
    return {
      background: 'var(--accent-soft)',
      color: 'var(--accent)',
      border: '1px solid var(--accent-border-soft)',
    };
  }

  // Hex color (#RRGGBB)
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return {
      background: `${color}28`,
      color: color,
      border: `1px solid ${color}55`,
    };
  }

  // Short hex (#RGB)
  if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
    const fullHex = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    return {
      background: `${fullHex}28`,
      color: fullHex,
      border: `1px solid ${fullHex}55`,
    };
  }

  // CSS variables handling
  if (color.includes('--credit')) {
    return {
      background: 'var(--credit-bg, rgba(16, 185, 129, 0.16))',
      color: 'var(--credit, #10b981)',
      border: '1px solid var(--credit-border, rgba(16, 185, 129, 0.35))',
    };
  }

  if (color.includes('--debit')) {
    return {
      background: 'var(--debit-bg, rgba(239, 68, 68, 0.16))',
      color: 'var(--debit, #ef4444)',
      border: '1px solid var(--debit-border, rgba(239, 68, 68, 0.35))',
    };
  }

  if (color.includes('--amber')) {
    return {
      background: 'var(--amber-bg, rgba(245, 158, 11, 0.16))',
      color: 'var(--amber, #f59e0b)',
      border: '1px solid var(--amber-border, rgba(245, 158, 11, 0.35))',
    };
  }

  return {
    background: 'var(--accent-soft)',
    color: color || 'var(--accent)',
    border: '1px solid var(--accent-border-soft)',
  };
}

export interface AvatarPlaceholderResult {
  color: string;
  style: React.CSSProperties;
  initial: string;
  type: ContactType;
  isVendor: boolean;
  isSubscription: boolean;
  isFriend: boolean;
  hasCustomNumber: boolean;
}

/**
 * Shared utility to generate consistent avatar placeholders from a user ID or contact object.
 * Maps user/contact ID deterministically to the same avatar color, style, and icon metadata.
 */
export function getAvatarPlaceholder(
  contactOrId?: string | { id?: string; name?: string; color?: string; avatarNumber?: string; type?: ContactType } | null,
  options?: { fallbackType?: ContactType; defaultColor?: string }
): AvatarPlaceholderResult {
  const fallbackType: ContactType = options?.fallbackType || 'friend';

  if (!contactOrId) {
    const color = options?.defaultColor || AVATAR_PALETTE[0];
    return {
      color,
      style: getAvatarStyle(color),
      initial: '?',
      type: fallbackType,
      isVendor: fallbackType === 'vendor',
      isSubscription: fallbackType === 'subscription',
      isFriend: fallbackType === 'friend',
      hasCustomNumber: false,
    };
  }

  if (typeof contactOrId === 'string') {
    const color = getConsistentAvatarColor(contactOrId, options?.defaultColor);
    const initial = contactOrId.trim().charAt(0).toUpperCase() || '?';
    return {
      color,
      style: getAvatarStyle(color),
      initial,
      type: fallbackType,
      isVendor: fallbackType === 'vendor',
      isSubscription: fallbackType === 'subscription',
      isFriend: fallbackType === 'friend',
      hasCustomNumber: false,
    };
  }

  const type: ContactType = contactOrId.type || fallbackType;
  const color = getConsistentAvatarColor(contactOrId, options?.defaultColor);
  const initial = friendInitial(contactOrId.name, contactOrId.avatarNumber);
  const hasCustomNumber = Boolean(contactOrId.avatarNumber && contactOrId.avatarNumber.trim());

  return {
    color,
    style: getAvatarStyle(color),
    initial,
    type,
    isVendor: type === 'vendor',
    isSubscription: type === 'subscription',
    isFriend: type === 'friend',
    hasCustomNumber,
  };
}

/**
 * Returns consistent contact color with support for custom vs ID-mapped deterministic palette.
 */
export function getContactColor(contact?: { id?: string; name?: string; type?: ContactType; color?: string } | null, fallback?: string): string {
  if (!contact) return fallback || 'var(--accent)';
  return getConsistentAvatarColor(contact, fallback);
}

/**
 * Returns consistent contact avatar CSS style.
 */
export function getContactStyle(contact?: { id?: string; name?: string; type?: ContactType; color?: string } | null, fallback?: string): React.CSSProperties {
  const color = getContactColor(contact, fallback);
  return getAvatarStyle(color);
}
