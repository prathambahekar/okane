import type { Category, Expense } from '../types';

/**
 * Common keyword associations mapped to standard category names or keywords.
 * Used for zero-latency instant offline category auto-detection.
 */
const KEYWORD_RULES: Record<string, string[]> = {
  Food: [
    'pizza', 'burger', 'cafe', 'coffee', 'starbucks', 'diner', 'restaurant', 'lunch',
    'dinner', 'breakfast', 'brunch', 'subway', 'mcdonald', 'kfc', 'swiggy', 'zomato',
    'doordash', 'ubereats', 'snack', 'tea', 'bakery', 'sushi', 'taco', 'bar', 'drink',
    'bistro', 'food', 'meal', 'icecream', 'dessert', 'chai', 'smoothie', 'sandwich', 'pasta'
  ],
  Groceries: [
    'grocery', 'supermarket', 'walmart', 'costco', 'trader joe', 'target', 'kroger',
    'aldi', 'whole foods', 'vegetable', 'fruit', 'milk', 'bread', 'eggs', 'market',
    'instacart', 'provision', 'meat', 'dairy', 'zepto', 'blinkit', 'instamart', 'bigbasket'
  ],
  Transport: [
    'uber', 'lyft', 'ola', 'cab', 'taxi', 'fuel', 'petrol', 'gas', 'diesel', 'parking',
    'toll', 'metro', 'subway', 'bus', 'train', 'flight', 'airline', 'transit', 'car',
    'auto', 'rickshaw', 'commute', 'ticket'
  ],
  Rent: [
    'rent', 'apartment', 'landlord', 'flat', 'lease', 'house rent', 'pg rent', 'room rent'
  ],
  Utilities: [
    'electricity', 'electric', 'water bill', 'power bill', 'gas bill', 'internet',
    'wifi', 'broadband', 'phone bill', 'mobile recharge', 'dth', 'recharge', 'utility',
    'maintenance', 'bill', 'sewer', 'trash', 'verizon', 'at&t', 'jio', 'airtel'
  ],
  Entertainment: [
    'netflix', 'spotify', 'movie', 'cinema', 'theatre', 'theater', 'disney', 'hulu',
    'prime video', 'youtube', 'game', 'gaming', 'steam', 'playstation', 'xbox', 'concert',
    'club', 'pub', 'party', 'event', 'bowling', 'arcade', 'amusement', 'show'
  ],
  Shopping: [
    'amazon', 'flipkart', 'cloth', 'shirt', 'shoes', 'electronics', 'apple', 'nike',
    'adidas', 'zara', 'h&m', 'mall', 'shopping', 'store', 'apparel', 'gadget', 'laptop',
    'headphone', 'watch', 'book', 'myntra', 'ebay', 'aliexpress', 'shein'
  ],
  Travel: [
    'hotel', 'airbnb', 'flight', 'resort', 'vacation', 'trip', 'booking.com', 'expedia',
    'hostel', 'tour', 'sightseeing', 'luggage', 'visa', 'cruise', 'makemytrip', 'agoda'
  ],
  Health: [
    'doctor', 'dentist', 'pharmacy', 'medicine', 'hospital', 'clinic', 'medical', 'gym',
    'fitness', 'supplement', 'therapy', 'dental', 'optometrist', 'eyewear', 'health',
    'checkup', 'prescription', 'cvs', 'walgreens', 'apollo'
  ],
  Income: [
    'salary', 'bonus', 'freelance', 'dividend', 'interest', 'stipend', 'paycheck',
    'consulting', 'profit', 'cashback', 'revenue', 'wage'
  ],
  Refund: [
    'refund', 'reimbursement', 'cashback', 'returned', 'return'
  ],
};

/**
 * Helper to match category name leniently against standard names or user categories
 */
function findMatchingCategoryName(targetName: string, availableCategories: Category[]): string | null {
  const normTarget = targetName.toLowerCase().trim();
  
  // Exact match
  const exact = availableCategories.find(c => c.name.toLowerCase() === normTarget);
  if (exact) return exact.name;

  // Substring match (e.g. "Food & Dining" matches "Food")
  const partial = availableCategories.find(c => 
    c.name.toLowerCase().includes(normTarget) || normTarget.includes(c.name.toLowerCase())
  );
  if (partial) return partial.name;

  return null;
}

/**
 * Fast zero-latency smart category detector:
 * 1. Checks user's historical transactions for repeat items.
 * 2. Matches keywords against curated rules dictionary.
 */
export function detectCategoryFromText(
  description: string,
  categories: Category[],
  pastExpenses: Expense[] = []
): string | null {
  const trimmed = description.trim().toLowerCase();
  if (!trimmed || trimmed.length < 2) return null;

  // Clean words list
  const words = trimmed.split(/[\s,._\-/+()]+/).filter(w => w.length >= 2);
  if (words.length === 0) return null;

  // --- Tier 1: User's Historical Memory ---
  if (pastExpenses.length > 0) {
    // 1a. Exact description match (case-insensitive)
    const exactPast = pastExpenses.find(
      e => e.description && e.description.trim().toLowerCase() === trimmed && e.category
    );
    if (exactPast) {
      const match = findMatchingCategoryName(exactPast.category, categories);
      if (match) return match;
    }

    // 1b. Match prefix or leading token if description starts with a known merchant/item
    const firstWord = words[0];
    if (firstWord.length >= 3) {
      const pastWordMatch = pastExpenses.find(
        e => e.description && e.description.trim().toLowerCase().startsWith(firstWord) && e.category
      );
      if (pastWordMatch) {
        const match = findMatchingCategoryName(pastWordMatch.category, categories);
        if (match) return match;
      }
    }
  }

  // --- Tier 2: Keyword Rules Dictionary ---
  for (const [categoryKey, keywords] of Object.entries(KEYWORD_RULES)) {
    // Check if any keyword matches a word or phrase in description
    const isMatched = keywords.some(kw => {
      if (kw.includes(' ')) {
        return trimmed.includes(kw);
      }
      return words.includes(kw) || words.some(w => w.startsWith(kw) || (kw.length > 4 && w.includes(kw)));
    });

    if (isMatched) {
      const match = findMatchingCategoryName(categoryKey, categories);
      if (match) return match;
    }
  }

  return null;
}
