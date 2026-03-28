export interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

export interface Recipe {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  servings: number;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  category: string | null;
  tags: string[];
  ingredients: Ingredient[];
  instructions: string[];
  calories_per_serving: number | null;
  protein_grams: number | null;
  carbs_grams: number | null;
  fat_grams: number | null;
  fiber_grams: number | null;
  source_json: any;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

// Store section categories for shopping list grouping
export const STORE_SECTIONS: Record<string, string[]> = {
  'Dairy & Eggs': ['milk', 'cream', 'cheese', 'butter', 'yogurt', 'egg', 'sour cream', 'cottage cheese', 'whipping cream', 'cheddar', 'mozzarella', 'parmesan', 'ricotta', 'feta'],
  'Meat & Poultry': ['chicken', 'beef', 'pork', 'turkey', 'lamb', 'sausage', 'bacon', 'ham', 'ground', 'steak', 'breast', 'thigh', 'wing'],
  'Seafood': ['fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'cod', 'tilapia', 'crab', 'lobster', 'mussel', 'clam'],
  'Fruits': ['apple', 'banana', 'orange', 'lemon', 'lime', 'berry', 'strawberry', 'blueberry', 'raspberry', 'grape', 'mango', 'pineapple', 'peach', 'pear', 'avocado', 'tomato'],
  'Vegetables': ['onion', 'garlic', 'potato', 'carrot', 'celery', 'pepper', 'broccoli', 'spinach', 'lettuce', 'cucumber', 'zucchini', 'mushroom', 'corn', 'pea', 'bean', 'cabbage', 'kale', 'cauliflower', 'eggplant', 'squash', 'asparagus', 'leek', 'shallot', 'ginger', 'jalapeño', 'chili'],
  'Bakery & Bread': ['bread', 'tortilla', 'bun', 'roll', 'pita', 'naan', 'croissant', 'bagel', 'wrap'],
  'Pasta & Grains': ['pasta', 'spaghetti', 'rice', 'noodle', 'quinoa', 'couscous', 'oat', 'barley', 'farro', 'penne', 'fusilli', 'macaroni'],
  'Canned & Jarred': ['canned', 'tomato sauce', 'tomato paste', 'broth', 'stock', 'coconut milk', 'beans', 'chickpea', 'lentil', 'salsa', 'olive'],
  'Oils & Condiments': ['oil', 'olive oil', 'vinegar', 'soy sauce', 'mustard', 'ketchup', 'mayonnaise', 'hot sauce', 'worcestershire', 'honey', 'maple syrup', 'sesame oil'],
  'Spices & Seasonings': ['salt', 'pepper', 'cumin', 'paprika', 'oregano', 'basil', 'thyme', 'rosemary', 'cinnamon', 'nutmeg', 'turmeric', 'chili powder', 'curry', 'bay leaf', 'parsley', 'cilantro', 'dill', 'sage', 'vanilla'],
  'Baking': ['flour', 'sugar', 'baking soda', 'baking powder', 'yeast', 'cocoa', 'chocolate', 'cornstarch'],
  'Frozen': ['frozen', 'ice cream'],
  'Beverages': ['water', 'juice', 'coffee', 'tea', 'wine', 'beer'],
  'Snacks & Nuts': ['nut', 'almond', 'walnut', 'pecan', 'peanut', 'cashew', 'pistachio', 'seed', 'chip', 'cracker'],
};

export function getStoreSection(ingredientName: string): string {
  const lower = ingredientName.toLowerCase();
  for (const [section, keywords] of Object.entries(STORE_SECTIONS)) {
    if (keywords.some((kw) => lower.includes(kw))) return section;
  }
  return 'Other';
}

export interface ShoppingListItem {
  id: string;
  user_id: string;
  recipe_id: string | null;
  ingredient_name: string;
  quantity: string | null;
  unit: string | null;
  checked: boolean;
  created_at: string;
}

export const CATEGORIES = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Appetizer',
  'Dessert',
  'Snack',
  'Beverage',
  'Soup',
  'Salad',
  'Side Dish',
] as const;

export const COMMON_TAGS = [
  'Vegan',
  'Vegetarian',
  'Gluten-Free',
  'Dairy-Free',
  'Quick',
  '15 mins',
  '30 mins',
  'Healthy',
  'Comfort Food',
  'Meal Prep',
] as const;
