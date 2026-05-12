import { Link } from 'react-router-dom';
import { Clock, Users, User, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Recipe } from '@/types/recipe';
import { getRecipeSourceLabel, isOwnRecipe } from '@/lib/recipeSource';

export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  return (
    <Link
      to={`/recipe/${recipe.id}`}
      className="group block overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm card-cozy animate-fade-in"
    >
      <div className="aspect-[16/10] overflow-hidden bg-muted relative">
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt={recipe.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/40">
            <span className="text-5xl">🍽️</span>
          </div>
        )}
        {/* Warm gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/10 via-transparent to-transparent" />
        {recipe.category && (
          <Badge className="absolute top-3 left-3 bg-card/85 backdrop-blur-sm text-foreground border-0 text-xs font-body shadow-sm">
            {recipe.category}
          </Badge>
        )}
      </div>
      <div className="p-4 space-y-2.5">
        <h3 className="font-display text-lg font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {recipe.title}
        </h3>
        {recipe.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 font-body leading-relaxed">
            {recipe.description}
          </p>
        )}
        <div className="flex items-center gap-4 text-xs text-muted-foreground font-body pt-1 flex-wrap">
          {totalTime > 0 && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary/70" />
              {totalTime} min
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary/70" />
            {recipe.servings} servings
          </span>
          <span className="flex items-center gap-1.5 ml-auto">
            {isOwnRecipe(recipe.source_url) ? (
              <User className="h-3.5 w-3.5 text-primary/70" />
            ) : (
              <Globe className="h-3.5 w-3.5 text-primary/70" />
            )}
            <span className="truncate max-w-[120px]">{getRecipeSourceLabel(recipe.source_url)}</span>
          </span>
        </div>
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {recipe.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[11px] font-body text-muted-foreground bg-muted/70 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}