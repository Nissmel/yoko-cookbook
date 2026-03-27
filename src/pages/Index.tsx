import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, BookOpen } from 'lucide-react';
import { useRecipes } from '@/hooks/useRecipes';
import RecipeCard from '@/components/RecipeCard';
import AppLayout from '@/components/AppLayout';
import { CATEGORIES } from '@/types/recipe';

export default function Index() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const { data: recipes, isLoading } = useRecipes(search, category);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            My Cookbook
          </h1>
          <p className="text-muted-foreground font-body">
            Your personal recipe collection
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={category} onValueChange={(v) => setCategory(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl bg-muted animate-pulse aspect-[4/5]" />
            ))}
          </div>
        ) : recipes && recipes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <BookOpen className="h-8 w-8" />
            </div>
            <h2 className="font-display text-xl font-semibold text-foreground">No recipes yet</h2>
            <p className="text-muted-foreground font-body max-w-sm">
              Start building your cookbook by creating your first recipe or importing one from JSON.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
