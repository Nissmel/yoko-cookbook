import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, BookOpen, PlusCircle } from 'lucide-react';
import { useRecipes } from '@/hooks/useRecipes';
import { useAuth } from '@/hooks/useAuth';
import RecipeCard from '@/components/RecipeCard';
import AppLayout from '@/components/AppLayout';
import { CATEGORIES } from '@/types/recipe';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function Index() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const { data: recipes, isLoading } = useRecipes(search, category);
  const { user } = useAuth();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const firstName = user?.user_metadata?.full_name?.split(' ')[0]
    || user?.user_metadata?.name?.split(' ')[0]
    || '';

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 space-y-6">
        {/* Greeting header */}
        <div className="space-y-1">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            {greeting}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p className="text-muted-foreground font-body text-base">
            {recipes?.length
              ? `You have ${recipes.length} recipe${recipes.length > 1 ? 's' : ''} in your cookbook`
              : 'Your personal recipe collection'}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-xl bg-card border-border/60 font-body"
            />
          </div>
          <Select value={category} onValueChange={(v) => setCategory(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-48 h-11 rounded-xl bg-card border-border/60">
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
              <div key={i} className="rounded-2xl bg-card animate-pulse aspect-[4/5] border border-border/30" />
            ))}
          </div>
        ) : recipes && recipes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary">
              <BookOpen className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-bold text-foreground">No recipes yet</h2>
              <p className="text-muted-foreground font-body max-w-sm text-base leading-relaxed">
                Start building your cookbook by creating your first recipe or importing one from a URL.
              </p>
            </div>
            <div className="flex gap-3">
              <Button asChild className="gap-2 rounded-xl h-11">
                <Link to="/create"><PlusCircle className="h-4 w-4" /> Create Recipe</Link>
              </Button>
              <Button asChild variant="outline" className="gap-2 rounded-xl h-11">
                <Link to="/import">Import Recipe</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}