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
  created_at: string;
  updated_at: string;
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
