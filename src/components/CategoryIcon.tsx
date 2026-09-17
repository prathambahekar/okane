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
  Cat,
  Music,
  Dumbbell,
  ShieldCheck,
  BookOpen,
  Baby,
  PiggyBank,
  Wrench,
  Sparkles,
  Pizza,
  Beer,
  Wine,
  Cake,
  IceCream,
  Apple,
  CupSoda,
  Bike,
  Bus,
  Train,
  Ship,
  ParkingCircle,
  Shirt,
  Scissors,
  Glasses,
  Watch,
  Package,
  Armchair,
  Bed,
  Flame,
  Droplet,
  Flower2,
  Bath,
  Ticket,
  Trophy,
  Palette,
  Mic,
  Headphones,
  Camera,
  CreditCard,
  Receipt,
  Coins,
  Wallet,
  Landmark,
  Percent,
  Pill,
  Stethoscope,
  Heart,
  School,
  Monitor,
  Printer,
  Cloud,
  Key,
  Hammer,
  Luggage,
  Compass,
  type LucideProps
} from 'lucide-react';

interface CategoryIconProps extends LucideProps {
  category?: string;
  icon?: string;
}

// Custom SVG component for Steam (official vector mark with crisp proportions)
export const SteamIcon = ({ size = 16, className = '', color, style, ...props }: LucideProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', color: color || 'currentColor', ...style }}
    {...props}
  >
    <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" />
  </svg>
);

export interface AvailableCategoryIcon {
  id: string;
  label: string;
  Icon: React.ElementType;
}

export const AVAILABLE_ICONS: AvailableCategoryIcon[] = [
  // Food & Dining
  { id: 'food', label: 'Food / Dining / Restaurant / Meal', Icon: Utensils },
  { id: 'groceries', label: 'Groceries / Supermarket / Mart / Veg', Icon: ShoppingCart },
  { id: 'cafe', label: 'Coffee / Cafe / Tea / Breakfast', Icon: Coffee },
  { id: 'pizza', label: 'Pizza / Fast Food / Burger / Snacks', Icon: Pizza },
  { id: 'drinks', label: 'Drinks / Alcohol / Beer / Bar / Pub', Icon: Beer },
  { id: 'wine', label: 'Wine / Nightlife / Cocktail / Club', Icon: Wine },
  { id: 'bakery', label: 'Bakery / Cake / Dessert / Birthday', Icon: Cake },
  { id: 'icecream', label: 'Ice Cream / Treats / Sweets', Icon: IceCream },
  { id: 'fruits', label: 'Fruits / Healthy / Diet / Nutrition', Icon: Apple },
  { id: 'soda', label: 'Beverages / Soda / Juice / Drinks', Icon: CupSoda },

  // Transportation
  { id: 'transport', label: 'Transport / Cab / Taxi / Ride', Icon: Car },
  { id: 'fuel', label: 'Fuel / Petrol / Diesel / Gas', Icon: Fuel },
  { id: 'bike', label: 'Bicycle / Bike / Scooter / Motorbike', Icon: Bike },
  { id: 'bus', label: 'Bus / Public Transit / Commute', Icon: Bus },
  { id: 'train', label: 'Train / Metro / Subway / Railway', Icon: Train },
  { id: 'travel', label: 'Travel / Flights / Trips / Airline', Icon: Plane },
  { id: 'ship', label: 'Ship / Cruise / Ferry / Boat', Icon: Ship },
  { id: 'parking', label: 'Parking / Toll / Fastag / Valet', Icon: ParkingCircle },
  { id: 'luggage', label: 'Luggage / Vacation / Tourism / Tour', Icon: Luggage },

  // Home & Housing
  { id: 'rent', label: 'Rent / Home / Housing / Apartment', Icon: Home },
  { id: 'utilities', label: 'Utilities / Electricity / Power / Bills', Icon: Zap },
  { id: 'wifi', label: 'Internet / Wifi / Broadband / Network', Icon: Wifi },
  { id: 'gas', label: 'Gas / LPG / Heating / Cylinder', Icon: Flame },
  { id: 'water', label: 'Water / Plumbing / Utilities', Icon: Droplet },
  { id: 'furniture', label: 'Furniture / Decor / Sofa / Interior', Icon: Armchair },
  { id: 'hotel', label: 'Hotel / Stay / Room / Airbnb / Lodge', Icon: Bed },
  { id: 'garden', label: 'Garden / Plants / Flowers / Flora', Icon: Flower2 },
  { id: 'cleaning', label: 'Cleaning / Laundry / Bath / Wash', Icon: Bath },

  // Entertainment & Gaming
  { id: 'gaming', label: 'Gaming / Console / PlayStation / Xbox', Icon: Gamepad2 },
  { id: 'steam', label: 'Steam / PC Gaming / Valve', Icon: SteamIcon },
  { id: 'entertainment', label: 'Movies / Cinema / Theater / Films', Icon: Film },
  { id: 'music', label: 'Music / Audio / Spotify / Songs', Icon: Music },
  { id: 'tv', label: 'Subscriptions / OTT / Streaming / TV', Icon: Tv },
  { id: 'ticket', label: 'Tickets / Concert / Show / Event / Pass', Icon: Ticket },
  { id: 'sports', label: 'Sports / Tournament / Match / Trophy', Icon: Trophy },
  { id: 'art', label: 'Art / Design / Creative / Painting / Craft', Icon: Palette },
  { id: 'podcast', label: 'Podcast / Mic / Voice / Studio', Icon: Mic },
  { id: 'audio', label: 'Headphones / Audio / Earphones / Sound', Icon: Headphones },
  { id: 'camera', label: 'Camera / Photography / Photos / Video', Icon: Camera },
  { id: 'outdoor', label: 'Outdoors / Adventure / Trekking / Camping', Icon: Compass },

  // Shopping & Lifestyle
  { id: 'shopping', label: 'Shopping / Retail / Mall / Store', Icon: ShoppingBag },
  { id: 'clothes', label: 'Clothing / Apparel / Fashion / Shoes', Icon: Shirt },
  { id: 'beauty', label: 'Salon / Haircut / Barber / Grooming', Icon: Scissors },
  { id: 'glasses', label: 'Glasses / Eyewear / Opticals / Vision', Icon: Glasses },
  { id: 'watch', label: 'Watch / Jewelry / Accessories', Icon: Watch },
  { id: 'package', label: 'Delivery / Courier / Orders / Parcel', Icon: Package },
  { id: 'personal', label: 'Personal Care / Cosmetics / Spa / Beauty', Icon: Sparkles },
  { id: 'gift', label: 'Gifts / Celebrations / Festive / Present', Icon: Gift },

  // Tech & Work
  { id: 'tech', label: 'Electronics / Laptop / Computer / Tech', Icon: Laptop },
  { id: 'phone', label: 'Mobile / Phone / Cellular / Gadget', Icon: Smartphone },
  { id: 'desktop', label: 'Desktop / Monitor / Screen / PC', Icon: Monitor },
  { id: 'work', label: 'Work / Business / Office / Freelance', Icon: Briefcase },
  { id: 'office', label: 'Office / Printing / Stationery / Paper', Icon: Printer },
  { id: 'cloud', label: 'Cloud / SaaS / Software / Hosting', Icon: Cloud },
  { id: 'tools', label: 'Hardware / DIY / Repair / Construction', Icon: Hammer },
  { id: 'maintenance', label: 'Maintenance / Service / Fix / Repairs', Icon: Wrench },
  { id: 'security', label: 'Keys / Lock / Security / Access', Icon: Key },

  // Health, Family & Pets
  { id: 'health', label: 'Health / Medical / Clinic / Care', Icon: HeartPulse },
  { id: 'pharmacy', label: 'Pharmacy / Medicine / Prescription / Drugs', Icon: Pill },
  { id: 'doctor', label: 'Doctor / Hospital / Consultation / Checkup', Icon: Stethoscope },
  { id: 'fitness', label: 'Gym / Fitness / Workout / Exercise', Icon: Dumbbell },
  { id: 'pets', label: 'Pets / Animals / Dog / Puppy', Icon: Dog },
  { id: 'cat', label: 'Cat / Kitten / Feline / Pet', Icon: Cat },
  { id: 'baby', label: 'Baby / Kids / Childcare / Children', Icon: Baby },
  { id: 'education', label: 'Education / College / University / Degree', Icon: GraduationCap },
  { id: 'school', label: 'School / Tuition / Classes / Coaching', Icon: School },
  { id: 'books', label: 'Books / Reading / Courses / Study / Library', Icon: BookOpen },

  // Finance, Money & Taxes
  { id: 'income', label: 'Income / Salary / Profit / Earnings', Icon: TrendingUp },
  { id: 'refund', label: 'Refund / Cashback / Reversal / Return', Icon: RotateCcw },
  { id: 'savings', label: 'Savings / Piggy Bank / Deposit / Fund', Icon: PiggyBank },
  { id: 'investment', label: 'Investment / Stocks / Crypto / Mutual Funds', Icon: LineChart },
  { id: 'cards', label: 'Cards / Credit Card / EMI / Loan / Debt', Icon: CreditCard },
  { id: 'wallet', label: 'Wallet / Cash / Pocket Money / Allowance', Icon: Wallet },
  { id: 'cash', label: 'Coins / Cash / Currency / Change / Tips', Icon: Coins },
  { id: 'bills', label: 'Bills / Invoices / Receipt / Tax / GST', Icon: Receipt },
  { id: 'bank', label: 'Bank / Legal / Government / Treasury', Icon: Landmark },
  { id: 'interest', label: 'Interest / Discount / Fees / Percentage', Icon: Percent },
  { id: 'insurance', label: 'Insurance / Policy / Protection / Security', Icon: ShieldCheck },
  { id: 'charity', label: 'Charity / Donation / NGO / Relief', Icon: Heart },
  { id: 'transfer', label: 'Transfer / Send / Movement / Wire', Icon: ArrowLeftRight },
  { id: 'other', label: 'Other / Miscellaneous / Tags / General', Icon: Tag },
];

const iconMap: Record<string, React.ElementType> = {
  // Food & Dining
  food: Utensils,
  dining: Utensils,
  restaurant: Utensils,
  meal: Utensils,
  lunch: Utensils,
  dinner: Utensils,
  groceries: ShoppingCart,
  grocery: ShoppingCart,
  supermarket: ShoppingCart,
  mart: ShoppingCart,
  zepto: ShoppingCart,
  zeptoo: ShoppingCart,
  blinkit: ShoppingCart,
  instamart: ShoppingCart,
  bigbasket: ShoppingCart,
  cafe: Coffee,
  coffee: Coffee,
  tea: Coffee,
  chai: Coffee,
  starbucks: Coffee,
  pizza: Pizza,
  fastfood: Pizza,
  burger: Pizza,
  snacks: Pizza,
  drinks: Beer,
  alcohol: Beer,
  beer: Beer,
  bar: Beer,
  pub: Beer,
  wine: Wine,
  cocktail: Wine,
  nightlife: Wine,
  bakery: Cake,
  cake: Cake,
  birthday: Cake,
  dessert: Cake,
  icecream: IceCream,
  sweets: IceCream,
  fruits: Apple,
  fruit: Apple,
  apple: Apple,
  diet: Apple,
  nutrition: Apple,
  soda: CupSoda,
  beverages: CupSoda,
  beverage: CupSoda,
  juice: CupSoda,

  // Transport
  transport: Car,
  transportation: Car,
  car: Car,
  cab: Car,
  taxi: Car,
  uber: Car,
  lyft: Car,
  ola: Car,
  fuel: Fuel,
  gas: Fuel,
  petrol: Fuel,
  diesel: Fuel,
  bike: Bike,
  bicycle: Bike,
  scooter: Bike,
  motorcycle: Bike,
  bus: Bus,
  transit: Bus,
  commute: Bus,
  train: Train,
  metro: Train,
  subway: Train,
  railway: Train,
  travel: Plane,
  flight: Plane,
  flights: Plane,
  trip: Plane,
  trips: Plane,
  ship: Ship,
  cruise: Ship,
  ferry: Ship,
  boat: Ship,
  parking: ParkingCircle,
  toll: ParkingCircle,
  fastag: ParkingCircle,
  luggage: Luggage,
  vacation: Luggage,
  holiday: Luggage,
  tourism: Luggage,

  // Home & Housing
  rent: Home,
  housing: Home,
  home: Home,
  apartment: Home,
  flat: Home,
  property: Home,
  utilities: Zap,
  bills: Zap,
  electricity: Zap,
  power: Zap,
  wifi: Wifi,
  internet: Wifi,
  broadband: Wifi,
  network: Wifi,
  gasflame: Flame,
  lpg: Flame,
  cylinder: Flame,
  water: Droplet,
  plumbing: Droplet,
  furniture: Armchair,
  sofa: Armchair,
  decor: Armchair,
  hotel: Bed,
  stay: Bed,
  airbnb: Bed,
  room: Bed,
  garden: Flower2,
  flowers: Flower2,
  plants: Flower2,
  cleaning: Bath,
  laundry: Bath,
  bath: Bath,

  // Entertainment & Gaming
  gaming: Gamepad2,
  game: Gamepad2,
  games: Gamepad2,
  playstation: Gamepad2,
  ps5: Gamepad2,
  ps4: Gamepad2,
  xbox: Gamepad2,
  steam: SteamIcon,
  steampowered: SteamIcon,
  valve: SteamIcon,
  pcgaming: SteamIcon,
  entertainment: Film,
  movies: Film,
  movie: Film,
  cinema: Film,
  theater: Film,
  theatre: Film,
  music: Music,
  spotify: Music,
  songs: Music,
  tv: Tv,
  netflix: Tv,
  streaming: Tv,
  ott: Tv,
  ticket: Ticket,
  tickets: Ticket,
  concert: Ticket,
  sports: Trophy,
  sport: Trophy,
  trophy: Trophy,
  tournament: Trophy,
  art: Palette,
  design: Palette,
  craft: Palette,
  podcast: Mic,
  mic: Mic,
  voice: Mic,
  audio: Headphones,
  headphones: Headphones,
  earphones: Headphones,
  camera: Camera,
  photo: Camera,
  photography: Camera,
  outdoor: Compass,
  outdoors: Compass,
  adventure: Compass,
  trekking: Compass,

  // Shopping & Lifestyle
  shopping: ShoppingBag,
  store: ShoppingBag,
  mall: ShoppingBag,
  clothes: Shirt,
  clothing: Shirt,
  apparel: Shirt,
  shirt: Shirt,
  fashion: Shirt,
  beauty: Scissors,
  salon: Scissors,
  haircut: Scissors,
  barber: Scissors,
  grooming: Scissors,
  glasses: Glasses,
  eyewear: Glasses,
  opticals: Glasses,
  watch: Watch,
  jewelry: Watch,
  accessories: Watch,
  package: Package,
  delivery: Package,
  courier: Package,
  orders: Package,
  personal: Sparkles,
  spa: Sparkles,
  skincare: Sparkles,
  gift: Gift,
  donation: Gift,
  gifts: Gift,

  // Tech & Work
  tech: Laptop,
  laptop: Laptop,
  computer: Laptop,
  software: Laptop,
  phone: Smartphone,
  mobile: Smartphone,
  gadget: Smartphone,
  cellular: Smartphone,
  desktop: Monitor,
  monitor: Monitor,
  screen: Monitor,
  work: Briefcase,
  business: Briefcase,
  freelance: Briefcase,
  office: Printer,
  printer: Printer,
  stationery: Printer,
  cloud: Cloud,
  saas: Cloud,
  tools: Hammer,
  hardware: Hammer,
  diy: Hammer,
  maintenance: Wrench,
  repair: Wrench,
  repairs: Wrench,
  service: Wrench,
  security: Key,
  key: Key,
  keys: Key,
  lock: Key,

  // Health, Family & Pets
  health: HeartPulse,
  medical: HeartPulse,
  doctor: Stethoscope,
  hospital: Stethoscope,
  clinic: Stethoscope,
  pharmacy: Pill,
  medicine: Pill,
  medicines: Pill,
  pills: Pill,
  fitness: Dumbbell,
  gym: Dumbbell,
  workout: Dumbbell,
  exercise: Dumbbell,
  pets: Dog,
  pet: Dog,
  dog: Dog,
  puppy: Dog,
  cat: Cat,
  kitten: Cat,
  baby: Baby,
  kids: Baby,
  childcare: Baby,
  education: GraduationCap,
  college: GraduationCap,
  university: GraduationCap,
  tuition: GraduationCap,
  school: School,
  classes: School,
  books: BookOpen,
  book: BookOpen,
  courses: BookOpen,
  library: BookOpen,

  // Finance, Money & Taxes
  income: TrendingUp,
  salary: TrendingUp,
  profit: TrendingUp,
  earnings: TrendingUp,
  refund: RotateCcw,
  cashback: RotateCcw,
  return: RotateCcw,
  settlement: RotateCcw,
  settled: RotateCcw,
  settle: RotateCcw,
  savings: PiggyBank,
  piggybank: PiggyBank,
  investment: LineChart,
  stocks: LineChart,
  crypto: LineChart,
  mutualfunds: LineChart,
  cards: CreditCard,
  card: CreditCard,
  creditcard: CreditCard,
  emi: CreditCard,
  loan: CreditCard,
  wallet: Wallet,
  cash: Coins,
  coins: Coins,
  billsreceipt: Receipt,
  receipt: Receipt,
  tax: Receipt,
  taxes: Receipt,
  invoice: Receipt,
  bank: Landmark,
  legal: Landmark,
  government: Landmark,
  interest: Percent,
  discount: Percent,
  fees: Percent,
  insurance: ShieldCheck,
  charity: Heart,
  transfer: ArrowLeftRight,
  transferring: ArrowLeftRight,
  move: ArrowLeftRight,
  other: Tag,
};

export function CategoryIcon({ category = '', icon = '', size = 16, className = '', style, ...props }: CategoryIconProps) {
  const iconKey = (icon || '').trim().toLowerCase();
  const categoryKey = (category || '').trim().toLowerCase();
  
  let IconComponent;
  if (iconKey && iconKey !== 'other' && iconKey !== 'tag' && iconMap[iconKey]) {
    IconComponent = iconMap[iconKey];
  } else if (categoryKey && iconMap[categoryKey]) {
    IconComponent = iconMap[categoryKey];
  } else if (iconKey && iconMap[iconKey]) {
    IconComponent = iconMap[iconKey];
  } else {
    if (categoryKey.includes('zepto') || categoryKey.includes('blinkit') || categoryKey.includes('instamart') || categoryKey.includes('grocer')) {
      IconComponent = ShoppingCart;
    } else {
      IconComponent = Tag;
    }
  }

  return <IconComponent size={size} className={className} style={{ flexShrink: 0, ...style }} {...props} />;
}

export default CategoryIcon;

interface CategoryBadgeProps {
  category?: string;
  color?: string;
  icon?: string;
  size?: number;
  showLabel?: boolean;
}

export function CategoryBadge({ category = '', color, icon = '', size = 14, showLabel = true }: CategoryBadgeProps) {
  const isSettlement = (category || '').trim().toLowerCase() === 'settlement' || (icon || '').trim().toLowerCase() === 'settlement' || (icon || '').trim().toLowerCase() === 'refund';
  const iconColor = color || (isSettlement ? '#10B981' : 'var(--accent)');
  
  // Safe background tint calculation
  const bgStyle = color && color.startsWith('#') && color.length === 7
    ? `${color}20` // 12% opacity tint for hex colors
    : (isSettlement ? 'rgba(16, 185, 129, 0.12)' : 'var(--accent-soft)');

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

// Memento Minimalist Dark: Top-Right Category Icon
// "Prominent circular badge w-6.5 h-6.5 rounded-full flex items-center justify-center shrink-0 border containing a w-3.5 h-3.5 stroke-[2] icon."
export interface TopRightCategoryIconProps {
  category?: string;
  icon?: string;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
  borderColor?: string;
  bg?: string;
}

export function TopRightCategoryIcon({
  category = '',
  icon = '',
  className = '',
  style,
  color = '#ffffff',
  borderColor = 'rgba(255, 255, 255, 0.15)',
  bg = 'rgba(255, 255, 255, 0.05)',
}: TopRightCategoryIconProps) {
  return (
    <div
      className={`w-6.5 h-6.5 rounded-full flex items-center justify-center shrink-0 border ${className}`}
      style={{
        width: 26,
        height: 26,
        borderColor: borderColor,
        backgroundColor: bg,
        color: color,
        ...style,
      }}
    >
      <CategoryIcon
        category={category}
        icon={icon}
        size={14}
        className="w-3.5 h-3.5 stroke-[2]"
        style={{ color: color }}
      />
    </div>
  );
}

// Memento Minimalist Dark: Bottom-Left Indicators
// "Compact capsule badge px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 with a smaller w-2.5 h-2.5 stroke-[2.5] icon."
export interface BottomLeftIndicatorProps {
  label: string;
  icon?: React.ElementType;
  className?: string;
  style?: React.CSSProperties;
  semantic?: 'checklist' | 'todo' | 'security' | 'passkeys' | 'notes' | 'ideas' | 'journal' | 'diary' | 'audio' | 'voice' | 'media' | 'photos';
}

export function BottomLeftIndicator({
  label,
  icon: IconComponent,
  className = '',
  style,
  semantic,
}: BottomLeftIndicatorProps) {
  const semanticClasses: Record<string, string> = {
    checklist: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    todo: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    security: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    passkeys: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    notes: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
    ideas: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
    journal: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
    diary: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
    audio: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
    voice: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
    media: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
    photos: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  };

  const badgeClass = semantic && semanticClasses[semantic]
    ? semanticClasses[semantic]
    : 'bg-neutral-800/80 text-neutral-300 border-neutral-700/50';

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 border ${badgeClass} ${className}`}
      style={style}
    >
      {IconComponent && <IconComponent className="w-2.5 h-2.5 stroke-[2.5]" size={10} />}
      <span>{label}</span>
    </span>
  );
}
