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
  icon?: string;
}

export const AVAILABLE_ICONS = [
  { id: 'food', label: 'Food / Dining', Icon: Utensils },
  { id: 'groceries', label: 'Groceries', Icon: ShoppingCart },
  { id: 'transport', label: 'Transport / Fuel', Icon: Car },
  { id: 'rent', label: 'Rent / Home', Icon: Home },
  { id: 'utilities', label: 'Utilities / Bills', Icon: Zap },
  { id: 'entertainment', label: 'Entertainment / Movies', Icon: Film },
  { id: 'shopping', label: 'Shopping', Icon: ShoppingBag },
  { id: 'travel', label: 'Travel / Flights', Icon: Plane },
  { id: 'health', label: 'Health / Medical', Icon: HeartPulse },
  { id: 'income', label: 'Income / Salary', Icon: TrendingUp },
  { id: 'refund', label: 'Refund / Cashback', Icon: RotateCcw },
  { id: 'education', label: 'Education', Icon: GraduationCap },
  { id: 'gift', label: 'Gift', Icon: Gift },
  { id: 'investment', label: 'Investment', Icon: LineChart },
  { id: 'tv', label: 'Subscriptions / TV', Icon: Tv },
  { id: 'cafe', label: 'Coffee / Cafe', Icon: Coffee },
  { id: 'work', label: 'Work / Business', Icon: Briefcase },
  { id: 'other', label: 'Other / Tag', Icon: Tag },
];

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

export default function CategoryIcon({ category = '', icon = '', size = 16, className = '', style, ...props }: CategoryIconProps) {
  const iconKey = (icon || '').trim().toLowerCase();
  const categoryKey = (category || '').trim().toLowerCase();
  const IconComponent = iconMap[iconKey] || iconMap[categoryKey] || Tag;
  
  return <IconComponent size={size} className={className} style={{ flexShrink: 0, ...style }} {...props} />;
}

interface CategoryBadgeProps {
  category?: string;
  color?: string;
  icon?: string;
  size?: number;
  showLabel?: boolean;
}

export function CategoryBadge({ category = '', color, icon = '', size = 14, showLabel = true }: CategoryBadgeProps) {
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
        <CategoryIcon category={category} icon={icon} size={size} style={{ color: iconColor }} />
      </span>
      {showLabel && <span>{category}</span>}
    </span>
  );
}
