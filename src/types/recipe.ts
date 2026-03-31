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
// Store section categories for shopping list grouping (Polish)
export const STORE_SECTIONS: Record<string, string[]> = {
  'Nabiał i Jajka': ['mleko', 'śmietana', 'śmietanka', 'ser', 'masło', 'jogurt', 'jajko', 'jajka', 'twaróg', 'kefir', 'maślanka', 'cheddar', 'mozzarella', 'parmezan', 'ricotta', 'feta', 'cream', 'milk', 'cheese', 'butter', 'yogurt', 'egg', 'sour cream'],
  'Mięso i Drób': ['kurczak', 'wołowina', 'wieprzowina', 'indyk', 'jagnięcina', 'kiełbasa', 'boczek', 'szynka', 'mielone', 'stek', 'pierś', 'udko', 'skrzydełko', 'chicken', 'beef', 'pork', 'turkey', 'bacon', 'ham', 'sausage', 'ground', 'steak'],
  'Ryby i Owoce Morza': ['ryba', 'łosoś', 'tuńczyk', 'krewetki', 'dorsz', 'tilapia', 'krab', 'homar', 'małże', 'śledź', 'makrela', 'fish', 'salmon', 'tuna', 'shrimp', 'cod', 'prawn'],
  'Owoce': ['jabłko', 'banan', 'pomarańcza', 'cytryna', 'limonka', 'truskawka', 'malina', 'jagoda', 'borówka', 'winogrono', 'mango', 'ananas', 'brzoskwinia', 'gruszka', 'awokado', 'pomidor', 'apple', 'banana', 'orange', 'lemon', 'lime', 'berry', 'grape', 'mango', 'pineapple', 'tomato', 'avocado'],
  'Warzywa': ['cebula', 'czosnek', 'ziemniak', 'marchew', 'seler', 'papryka', 'brokuł', 'szpinak', 'sałata', 'ogórek', 'cukinia', 'pieczarki', 'grzyb', 'kukurydza', 'groch', 'fasola', 'kapusta', 'jarmuż', 'kalafior', 'bakłażan', 'dynia', 'szparagi', 'por', 'szalotka', 'imbir', 'jalapeño', 'chili', 'onion', 'garlic', 'potato', 'carrot', 'celery', 'pepper', 'broccoli', 'spinach', 'lettuce', 'cucumber', 'zucchini', 'mushroom', 'corn', 'cabbage', 'cauliflower', 'eggplant', 'squash', 'ginger'],
  'Pieczywo': ['chleb', 'bułka', 'tortilla', 'pita', 'naan', 'croissant', 'bagel', 'wrap', 'bread', 'roll', 'bajgiel', 'rogalik'],
  'Makarony i Kasze': ['makaron', 'spaghetti', 'ryż', 'kasza', 'kuskus', 'owies', 'płatki', 'penne', 'fusilli', 'noodle', 'pasta', 'rice', 'quinoa', 'farro', 'gryczana', 'jęczmienna', 'jaglana', 'bulgur'],
  'Konserwy i Słoiki': ['konserwa', 'passata', 'koncentrat', 'bulion', 'mleko kokosowe', 'ciecierzyca', 'soczewica', 'salsa', 'oliwki', 'ogórki konserwowe', 'canned', 'broth', 'stock', 'tomato sauce', 'tomato paste', 'coconut milk', 'chickpea', 'lentil'],
  'Oleje i Sosy': ['olej', 'oliwa', 'ocet', 'sos sojowy', 'musztarda', 'keczup', 'majonez', 'sos ostry', 'worcestershire', 'miód', 'syrop klonowy', 'sezamowy', 'oil', 'vinegar', 'soy sauce', 'mustard', 'ketchup', 'mayonnaise', 'honey'],
  'Przyprawy': ['sól', 'pieprz', 'kmin', 'kminek', 'papryka w proszku', 'oregano', 'bazylia', 'tymianek', 'rozmaryn', 'cynamon', 'gałka muszkatołowa', 'kurkuma', 'chili w proszku', 'curry', 'liść laurowy', 'pietruszka', 'kolendra', 'koperek', 'szałwia', 'wanilia', 'ziele angielskie', 'salt', 'pepper', 'cumin', 'paprika', 'oregano', 'basil', 'thyme', 'rosemary', 'cinnamon', 'turmeric', 'vanilla', 'parsley', 'cilantro', 'dill'],
  'Do Pieczenia': ['mąka', 'cukier', 'soda', 'proszek do pieczenia', 'drożdże', 'kakao', 'czekolada', 'skrobia', 'flour', 'sugar', 'baking soda', 'baking powder', 'yeast', 'cocoa', 'chocolate', 'cornstarch', 'cukier puder', 'cukier waniliowy'],
  'Mrożonki': ['mrożone', 'mrożonka', 'lody', 'frozen', 'ice cream'],
  'Napoje': ['woda', 'sok', 'kawa', 'herbata', 'wino', 'piwo', 'water', 'juice', 'coffee', 'tea', 'wine', 'beer'],
  'Przekąski i Orzechy': ['orzech', 'migdał', 'orzechy włoskie', 'pekan', 'fistaszki', 'nerkowce', 'pistacje', 'pestki', 'chipsy', 'krakersy', 'nut', 'almond', 'walnut', 'peanut', 'cashew', 'pistachio', 'seed', 'chip', 'cracker'],
};

export function getStoreSection(ingredientName: string): string {
  const lower = ingredientName.toLowerCase();
  for (const [section, keywords] of Object.entries(STORE_SECTIONS)) {
    if (keywords.some((kw) => lower.includes(kw))) return section;
  }
  return 'Inne';
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
