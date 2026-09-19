import React from 'react';
import { Store, Tv, User } from 'lucide-react';
import type { ContactType, Friend } from '../../types';
import { getAvatarPlaceholder, type AvatarPlaceholderResult } from '../../utils/avatar';
import { renderBrandLogo } from '../BrandIcons';

export interface ContactAvatarProps {
  contact?: (Partial<Friend> & { id?: string; name?: string; color?: string; avatarNumber?: string; type?: ContactType }) | null;
  id?: string;
  name?: string;
  color?: string;
  avatarNumber?: string;
  type?: ContactType;
  size?: number;
  fontSize?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
  iconSize?: number;
  showBrandLogo?: boolean;
}

/**
 * Reusable ContactAvatar component that consistently maps user/contact ID
 * to the exact same avatar color, style, and icon.
 */
export const ContactAvatar: React.FC<ContactAvatarProps> = ({
  contact,
  id,
  name,
  color,
  avatarNumber,
  type,
  size = 40,
  fontSize,
  borderRadius = 'var(--radius-sm)',
  className = 'avatar',
  style,
  iconSize,
  showBrandLogo = true,
}) => {
  const mergedContact = {
    id: id || contact?.id,
    name: name || contact?.name || '',
    color: color || contact?.color,
    avatarNumber: avatarNumber || contact?.avatarNumber,
    type: type || contact?.type || 'friend',
  };

  const placeholder: AvatarPlaceholderResult = getAvatarPlaceholder(mergedContact);

  const calculatedIconSize = iconSize || Math.max(14, Math.round(size * 0.45));
  const calculatedFontSize = fontSize || (placeholder.hasCustomNumber && placeholder.initial.length > 2
    ? Math.max(10, Math.round(size * 0.28))
    : Math.max(11, Math.round(size * 0.38)));

  let iconContent: React.ReactNode = null;

  if (placeholder.isSubscription) {
    const brandLogo = showBrandLogo ? renderBrandLogo(mergedContact.name, calculatedIconSize + 2) : null;
    iconContent = brandLogo || <Tv size={calculatedIconSize} />;
  } else if (placeholder.isVendor) {
    iconContent = <Store size={calculatedIconSize} />;
  } else {
    iconContent = placeholder.initial && placeholder.initial !== '?'
      ? placeholder.initial
      : <User size={calculatedIconSize} />;
  }

  return (
    <div
      className={className}
      style={{
        ...placeholder.style,
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        fontSize: calculatedFontSize,
        fontWeight: 700,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius,
        userSelect: 'none',
        ...style,
      }}
    >
      {iconContent}
    </div>
  );
};

export default ContactAvatar;
