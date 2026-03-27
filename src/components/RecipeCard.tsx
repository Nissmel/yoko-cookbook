import { Link } from 'react-router-dom';
import { Clock, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Recipe } from '@/types/recipe';

export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  return (
    <Link
      to={`/recipe/${recipe.id}`}
      className="group block overflow-hidden rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200 animate-fade-in"
    >
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt={recipe.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <span className="text-4xl">🍽️</span>
          </div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-display text-lg font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {recipe.title}
        </h3>
        {recipe.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 font-body">
            {recipe.description}
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-body">
          {totalTime > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {totalTime} min
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {recipe.servings} servings
          </span>
        </div>
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {recipe.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs font-body">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
