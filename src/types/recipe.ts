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

// Store section categories for shopping list grouping (Polish).
// Order matters: more specific sections (Mrożonki, Ryby) come before
// generic ones (Nabiał, Warzywa) so a "mrożony łosoś" lands in Mrożonki,
// not Ryby. Keywords are matched as substrings on the lowercased name,
// so use stems (e.g. "mrożon" covers mrożony/mrożona/mrożonka/mrożonki).
export const STORE_SECTIONS: Record<string, string[]> = {
  'Mrożonki': ['mrożon', 'mrożonk', 'mrozon', 'mrozonk', 'lody', 'frozen', 'ice cream'],
  'Ryby i Owoce Morza': ['ryba', 'ryby', 'filet rybny', 'łosoś', 'losos', 'tuńczyk', 'tunczyk', 'krewetk', 'dorsz', 'mintaj', 'tilapia', 'krab', 'homar', 'małż', 'malz', 'śledź', 'sledz', 'makrela', 'pstrąg', 'pstrag', 'sardynk', 'sandacz', 'okoń', 'okon', 'morszczuk', 'kalmar', 'ośmiornic', 'osmiornic', 'fish', 'salmon', 'tuna', 'shrimp', 'cod', 'prawn', 'mackerel', 'sardine', 'trout', 'squid'],
  'Mięso i Drób': ['kurczak', 'kurze', 'wołowin', 'wolowin', 'wieprzowin', 'indyk', 'indycz', 'jagnięcin', 'jagniecin', 'baranin', 'cielęcin', 'cielecin', 'kaczk', 'gęś', 'ges', 'królik', 'krolik', 'dziczyzn', 'sarnin', 'kiełbas', 'kielbas', 'parówk', 'parowk', 'boczek', 'szynka', 'szynki', 'mielone', 'mielona', 'mielony', 'stek', 'pierś', 'piers', 'udko', 'udka', 'skrzydełk', 'skrzydelk', 'polędwic', 'poledwic', 'schab', 'karkówk', 'karkowk', 'łopatk', 'lopatk', 'żeberk', 'zeberk', 'antrykot', 'rostbef', 'gulasz', 'kotlet', 'pasztet', 'salami', 'kabanos', 'mortadel', 'pastrami', 'chicken', 'beef', 'pork', 'turkey', 'duck', 'goose', 'lamb', 'veal', 'rabbit', 'venison', 'bacon', 'ham', 'sausage', 'ground meat', 'minced meat', 'steak', 'tenderloin', 'sirloin', 'brisket'],
  'Nabiał i Jajka': ['mleko', 'śmietan', 'smietan', 'serek', ' ser ', 'ser ', ' ser', 'masło', 'maslo', 'jogurt', 'jajko', 'jajka', 'jaja', 'twaróg', 'twarog', 'kefir', 'maślank', 'maslank', 'cheddar', 'mozzarell', 'parmezan', 'ricotta', 'feta', 'halloumi', 'gouda', 'camembert', 'brie', 'mascarpone', 'creme fraiche', 'cream', 'milk', 'cheese', 'butter', 'yogurt', 'egg', 'sour cream'],
  'Owoce': ['jabłk', 'jablk', 'banan', 'pomarańcz', 'pomarancz', 'cytryn', 'limonk', 'truskawk', 'malin', 'jagod', 'borówk', 'borowk', 'winogron', 'mango', 'ananas', 'brzoskwin', 'gruszk', 'awokado', 'arbuz', 'melon', 'kiwi', 'śliwk', 'sliwk', 'wiśni', 'wisni', 'czereśni', 'czeresni', 'morel', 'figa', 'figi', 'daktyl', 'rodzynk', 'żurawin', 'zurawin', 'granat', 'apple', 'banana', 'orange', 'lemon', 'lime', 'berry', 'grape', 'pineapple', 'avocado', 'watermelon', 'plum', 'cherry', 'apricot', 'date', 'raisin', 'cranberry', 'pomegranate'],
  'Warzywa': ['cebul', 'czosn', 'ziemniak', 'batat', 'słodki ziemniak', 'slodki ziemniak', 'marchew', 'marchewk', 'seler', 'papryk', 'pomidor', 'brokuł', 'brokul', 'szpinak', 'sałat', 'salat', 'rukol', 'roszponk', 'ogórek', 'ogorek', 'ogórk', 'ogork', 'cukini', 'pieczark', 'grzyb', 'borowik', 'kurk', 'kukurydz', 'groch', 'groszek', 'fasol', 'soczewic', 'kapust', 'jarmuż', 'jarmuz', 'kalafior', 'bakłażan', 'baklazan', 'dyni', 'dynia', 'szparag', 'por ', 'pora ', 'szalotk', 'imbir', 'jalapeño', 'jalapeno', 'chili', 'rzodkiewk', 'burak', 'rzepa', 'rzep ', 'pietruszk', 'pasternak', 'topinambur', 'kalarep', 'koper włoski', 'koper wloski', 'fenkuł', 'fenkul', 'tomato', 'onion', 'garlic', 'potato', 'sweet potato', 'carrot', 'celery', 'broccoli', 'spinach', 'lettuce', 'arugula', 'cucumber', 'zucchini', 'mushroom', 'corn', 'cabbage', 'cauliflower', 'eggplant', 'aubergine', 'squash', 'pumpkin', 'ginger', 'leek', 'shallot', 'radish', 'beet', 'turnip', 'parsnip', 'fennel', 'kale', 'bean', 'pea', 'lentil'],
  'Pieczywo': ['chleb', 'bułk', 'bulk', 'tortilla', 'pita', 'naan', 'croissant', 'bagel', 'bajgiel', 'wrap', 'rogalik', 'bagietk', 'grzank', 'bread', 'roll', 'baguette'],
  'Makarony i Kasze': ['makaron', 'spaghetti', 'tagliatell', 'penne', 'fusilli', 'lasagne', 'lazani', 'gnocchi', 'kluski', 'pierogi', 'ryż', 'ryz ', 'ryzu', 'ryżu', 'kasza', 'kaszy', 'kaszę', 'kasze', 'kuskus', 'owies', 'owsian', 'płatki', 'platki', 'noodle', 'pasta', 'rice', 'quinoa', 'farro', 'gryczan', 'jęczmien', 'jeczmien', 'jaglan', 'bulgur'],
  'Konserwy i Słoiki': ['konserw', 'passata', 'koncentrat pomidor', 'bulion', 'mleko kokosow', 'ciecierzyc', 'salsa', 'oliwki', 'kapary', 'ogórki konserwow', 'ogórki kiszon', 'ogorki konserwow', 'ogorki kiszon', 'kapusta kiszon', 'canned', 'broth', 'stock', 'tomato sauce', 'tomato paste', 'coconut milk', 'chickpea', 'olive', 'caper', 'pickle'],
  'Oleje i Sosy': ['olej', 'oliwa', 'ocet', 'sos sojow', 'sos rybny', 'musztard', 'keczup', 'ketchup', 'majonez', 'sos ostr', 'worcestershire', 'tabasco', 'sriracha', 'pesto', 'tahini', 'miód', 'miod ', 'syrop klonow', 'syrop daktylow', 'sezamow', 'oil', 'vinegar', 'soy sauce', 'mustard', 'mayonnaise', 'honey', 'maple syrup'],
  'Przyprawy': ['sól', 'sol ', 'pieprz', 'kmin', 'kminek', 'papryka w proszku', 'papryka słodka', 'papryka slodka', 'papryka ostra', 'papryka wędzona', 'papryka wedzona', 'oregano', 'bazyli', 'tymianek', 'rozmaryn', 'cynamon', 'gałka muszkatołow', 'galka muszkatolow', 'kurkum', 'chili w proszku', 'curry', 'garam masala', 'liść laurow', 'lisc laurow', 'pietruszka nać', 'pietruszka nac', 'kolendr', 'koperek', 'szałwi', 'szalwi', 'wanili', 'ziele angielsk', 'kardamon', 'goździk', 'gozdzik', 'anyż', 'anyz', 'majeranek', 'cząber', 'czaber', 'estragon', 'salt', 'pepper', 'cumin', 'paprika', 'basil', 'thyme', 'rosemary', 'cinnamon', 'turmeric', 'vanilla', 'parsley', 'cilantro', 'dill', 'sage', 'cardamom', 'clove', 'anise', 'marjoram', 'tarragon'],
  'Do Pieczenia': ['mąka', 'maka ', 'cukier', 'soda oczyszczon', 'proszek do pieczeni', 'drożdż', 'drozdz', 'kakao', 'czekolad', 'skrobia', 'żelatyn', 'zelatyn', 'agar', 'cukier puder', 'cukier waniliow', 'pasta migdałow', 'pasta migdalow', 'flour', 'sugar', 'baking soda', 'baking powder', 'yeast', 'cocoa', 'chocolate', 'cornstarch', 'gelatin'],
  'Napoje': ['woda', 'sok ', 'soku', 'kawa', 'kawy', 'herbat', 'wino', 'piwo', 'cydr', 'wódka', 'wodka', 'whisky', 'rum ', 'water', 'juice', 'coffee', 'tea', 'wine', 'beer', 'cider'],
  'Przekąski i Orzechy': ['orzech', 'migdał', 'migdal', 'pekan', 'fistaszk', 'nerkowc', 'pistacj', 'pestk', 'siemię lnian', 'siemie lnian', 'chia', 'sezam', 'mak ', 'maku', 'słonecznik', 'slonecznik', 'chipsy', 'krakers', 'nut', 'almond', 'walnut', 'peanut', 'cashew', 'pistachio', 'seed', 'flaxseed', 'sesame', 'sunflower', 'chip', 'cracker'],
};

export function getStoreSection(ingredientName: string): string {
  // Pad with spaces so ' ser ' / 'mak ' style boundary keywords work at start/end.
  const lower = ` ${ingredientName.toLowerCase()} `;
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
