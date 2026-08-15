/* eslint-disable react-refresh/only-export-components */
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
  ArrowLeftRight,
  Gamepad2,
  Laptop,
  Smartphone,
  Wifi,
  Fuel,
  Dog,
  Music,
  Dumbbell,
  ShieldCheck,
  BookOpen,
  Baby,
  PiggyBank,
  Wrench,
  Sparkles,
  type LucideProps
} from 'lucide-react';

interface CategoryIconProps extends LucideProps {
  category?: string;
  icon?: string;
}

// Custom SVG component for Steam (Gaming platform)
export const SteamIcon = ({ size = 16, className = '', color = 'currentColor', style, ...props }: LucideProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    <path d="M12 2a10 10 0 0 0-10 9.77c0 .12 0 .23.01.35l5.24 2.16a3.5 3.5 0 0 1 2.22-.8c.24 0 .47.03.69.07l2.5-3.63a4.98 4.98 0 0 1 7.34-3.92 5 5 0 0 1-7 6.47l-3.52 2.53c0 .11.02.22.02.34a3.5 3.5 0 0 1-3.5 3.5c-.88 0-1.68-.32-2.3-.87L.82 16.5A10 10 0 1 0 12 2zm0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 1.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM8.5 15.5a2.5 2.5 0 0 0-2.4 1.82l-1.63-.67a3.48 3.48 0 0 1 2.53-2.65 2.5 2.5 0 0 0 1.5 1.5zm0 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
  </svg>
);

export const AVAILABLE_ICONS = [
  { id: 'food', label: 'Food / Dining', Icon: Utensils },
  { id: 'groceries', label: 'Groceries', Icon: ShoppingCart },
  { id: 'transport', label: 'Transport / Cab', Icon: Car },
  { id: 'fuel', label: 'Fuel / Gas', Icon: Fuel },
  { id: 'rent', label: 'Rent / Home', Icon: Home },
  { id: 'utilities', label: 'Utilities / Bills', Icon: Zap },
  { id: 'wifi', label: 'Internet / Wifi / Mobile', Icon: Wifi },
  { id: 'steam', label: 'Steam / PC Gaming', Icon: SteamIcon },
  { id: 'gaming', label: 'Gaming / Console', Icon: Gamepad2 },
  { id: 'entertainment', label: 'Entertainment / Movies', Icon: Film },
  { id: 'music', label: 'Music / Audio', Icon: Music },
  { id: 'tv', label: 'Subscriptions / OTT', Icon: Tv },
  { id: 'shopping', label: 'Shopping / Clothes', Icon: ShoppingBag },
  { id: 'tech', label: 'Electronics / Laptop', Icon: Laptop },
  { id: 'phone', label: 'Mobile / Gadgets', Icon: Smartphone },
  { id: 'travel', label: 'Travel / Flights', Icon: Plane },
  { id: 'health', label: 'Health / Medical', Icon: HeartPulse },
  { id: 'fitness', label: 'Gym / Fitness', Icon: Dumbbell },
  { id: 'pets', label: 'Pets / Animals', Icon: Dog },
  { id: 'baby', label: 'Baby / Kids', Icon: Baby },
  { id: 'education', label: 'Education / Books', Icon: GraduationCap },
  { id: 'books', label: 'Reading / Courses', Icon: BookOpen },
  { id: 'gift', label: 'Gifts / Celebrations', Icon: Gift },
  { id: 'savings', label: 'Savings / Envelopes', Icon: PiggyBank },
  { id: 'investment', label: 'Investment / Stocks', Icon: LineChart },
  { id: 'insurance', label: 'Insurance / Security', Icon: ShieldCheck },
  { id: 'maintenance', label: 'Repairs / Service', Icon: Wrench },
  { id: 'income', label: 'Income / Salary', Icon: TrendingUp },
  { id: 'refund', label: 'Refund / Cashback', Icon: RotateCcw },
  { id: 'cafe', label: 'Coffee / Cafe', Icon: Coffee },
  { id: 'work', label: 'Work / Freelance', Icon: Briefcase },
  { id: 'transfer', label: 'Transfer / Move', Icon: ArrowLeftRight },
  { id: 'personal', label: 'Personal / Beauty', Icon: Sparkles },
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
  cab: Car,
  taxi: Car,
  fuel: Fuel,
  gas: Fuel,
  petrol: Fuel,
  diesel: Fuel,
  rent: Home,
  housing: Home,
  home: Home,
  utilities: Zap,
  bills: Zap,
  electricity: Zap,
  power: Zap,
  wifi: Wifi,
  internet: Wifi,
  broadband: Wifi,
  network: Wifi,
  steam: SteamIcon,
  steampowered: SteamIcon,
  gaming: Gamepad2,
  game: Gamepad2,
  games: Gamepad2,
  playstation: Gamepad2,
  xbox: Gamepad2,
  entertainment: Film,
  movies: Film,
  cinema: Film,
  music: Music,
  spotify: Music,
  songs: Music,
  tv: Tv,
  netflix: Tv,
  streaming: Tv,
  ott: Tv,
  shopping: ShoppingBag,
  clothes: ShoppingBag,
  apparel: ShoppingBag,
  tech: Laptop,
  laptop: Laptop,
  computer: Laptop,
  software: Laptop,
  phone: Smartphone,
  mobile: Smartphone,
  gadget: Smartphone,
  travel: Plane,
  flight: Plane,
  trip: Plane,
  hotel: Plane,
  health: HeartPulse,
  medical: HeartPulse,
  doctor: HeartPulse,
  medicine: HeartPulse,
  pharmacy: HeartPulse,
  fitness: Dumbbell,
  gym: Dumbbell,
  workout: Dumbbell,
  exercise: Dumbbell,
  pets: Dog,
  pet: Dog,
  dog: Dog,
  cat: Dog,
  vet: Dog,
  baby: Baby,
  kids: Baby,
  childcare: Baby,
  education: GraduationCap,
  college: GraduationCap,
  school: GraduationCap,
  tuition: GraduationCap,
  books: BookOpen,
  book: BookOpen,
  courses: BookOpen,
  gift: Gift,
  donation: Gift,
  charity: Gift,
  savings: PiggyBank,
  piggybank: PiggyBank,
  investment: LineChart,
  stocks: LineChart,
  crypto: LineChart,
  mutualfunds: LineChart,
  insurance: ShieldCheck,
  security: ShieldCheck,
  maintenance: Wrench,
  repair: Wrench,
  repairs: Wrench,
  service: Wrench,
  income: TrendingUp,
  salary: TrendingUp,
  dividend: TrendingUp,
  refund: RotateCcw,
  cashback: RotateCcw,
  return: RotateCcw,
  work: Briefcase,
  business: Briefcase,
  freelance: Briefcase,
  transfer: ArrowLeftRight,
  transferring: ArrowLeftRight,
  move: ArrowLeftRight,
  personal: Sparkles,
  beauty: Sparkles,
  salon: Sparkles,
  spa: Sparkles,
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
