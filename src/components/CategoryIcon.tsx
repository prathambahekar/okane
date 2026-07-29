import React from 'react';
import {
  Utensils,
  ShoppingCart,
  Car,
  Home,
  Zap,
  Film,
  ShoppingBag,
  Plane,
  HeartPulse,
  TrendingUp,
  RotateCcw,
  Tag,
  GraduationCap,
  Gift,
  LineChart,
  Tv,
  Coffee,
  Briefcase,
  type LucideProps
} from 'lucide-react';

interface CategoryIconProps extends LucideProps {
  category?: string;
}

const iconMap: Record<string, React.ElementType> = {
  food: Utensils,
  dining: Utensils,
  restaurant: Utensils,
  cafe: Coffee,
  coffee: Coffee,
  groceries: ShoppingCart,
  grocery: ShoppingCart,
  supermarket: ShoppingCart,
  transport: Car,
  transportation: Car,
  car: Car,
  fuel: Car,
  cab: Car,
  rent: Home,
  housing: Home,
  home: Home,
  utilities: Zap,
  bills: Zap,
  electricity: Zap,
  entertainment: Film,
  movies: Film,
  cinema: Film,
  shopping: ShoppingBag,
  clothes: ShoppingBag,
  travel: Plane,
  flight: Plane,
  health: HeartPulse,
  medical: HeartPulse,
  fitness: HeartPulse,
  income: TrendingUp,
  salary: TrendingUp,
  refund: RotateCcw,
  cashback: RotateCcw,
  education: GraduationCap,
  gift: Gift,
  investment: LineChart,
  tv: Tv,
  work: Briefcase,
  other: Tag,
};

export default function CategoryIcon({ category = '', size = 16, className = '', style, ...props }: CategoryIconProps) {
  const key = (category || '').trim().toLowerCase();
  const IconComponent = iconMap[key] || Tag;
  
  return <IconComponent size={size} className={className} style={{ flexShrink: 0, ...style }} {...props} />;
}

interface CategoryBadgeProps {
  category?: string;
  color?: string;
  size?: number;
  showLabel?: boolean;
}

export function CategoryBadge({ category = '', color, size = 14, showLabel = true }: CategoryBadgeProps) {
  const iconColor = color || 'var(--accent)';
  
  // Safe background tint calculation
  const bgStyle = color && color.startsWith('#') && color.length === 7
    ? `${color}20` // 12% opacity tint for hex colors
    : 'var(--accent-soft)';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size + 8,
          height: size + 8,
          borderRadius: 6,
          background: bgStyle,
          color: iconColor,
          flexShrink: 0,
        }}
      >
        <CategoryIcon category={category} size={size} style={{ color: iconColor }} />
      </span>
      {showLabel && <span>{category}</span>}
    </span>
  );
}
