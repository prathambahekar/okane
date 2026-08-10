import {
  PiggyBank,
  Shield,
  Plane,
  Laptop,
  Car,
  Home,
  Heart,
  Gift,
  GraduationCap,
  Target,
  Landmark,
  Smartphone,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

export const ENVELOPE_ICONS = [
  { name: 'piggy-bank', icon: PiggyBank, label: 'Savings' },
  { name: 'shield', icon: Shield, label: 'Emergency' },
  { name: 'plane', icon: Plane, label: 'Vacation' },
  { name: 'laptop', icon: Laptop, label: 'Tech / Laptop' },
  { name: 'car', icon: Car, label: 'Vehicle' },
  { name: 'home', icon: Home, label: 'Home' },
  { name: 'heart', icon: Heart, label: 'Health' },
  { name: 'gift', icon: Gift, label: 'Gift / Shopping' },
  { name: 'graduation-cap', icon: GraduationCap, label: 'Education' },
  { name: 'target', icon: Target, label: 'Goal' },
  { name: 'landmark', icon: Landmark, label: 'Investment' },
  { name: 'smartphone', icon: Smartphone, label: 'Gadget' },
  { name: 'shopping-bag', icon: ShoppingBag, label: 'Purchase' },
  { name: 'sparkles', icon: Sparkles, label: 'Special' },
];

export function getEnvelopeIconComponent(iconName?: string) {
  const found = ENVELOPE_ICONS.find(i => i.name === iconName);
  return found ? found.icon : PiggyBank;
}
