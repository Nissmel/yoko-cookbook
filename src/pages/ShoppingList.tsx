import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useShoppingList, useToggleShoppingItem, useDeleteShoppingItem, useClearCheckedItems, useClearAllItems } from '@/hooks/useShoppingList';
import { useRecipes } from '@/hooks/useRecipes';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, ShoppingCart, CheckCheck, Share2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getStoreSection } from '@/types/recipe';

export default function ShoppingList() {
  const { data: items, isLoading } = useShoppingList();
  const { data: recipes } = useRecipes();
  const toggleItem = useToggleShoppingItem();
  const deleteItem = useDeleteShoppingItem();
  const clearChecked = useClearCheckedItems();
  const clearAll = useClearAllItems();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const unchecked = items?.filter((i) => !i.checked) || [];
  const checked = items?.filter((i) => i.checked) || [];

  const bySection = unchecked.reduce((acc, item) => {
    const section = getStoreSection(item.ingredient_name);
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, typeof unchecked>);

  const byRecipe = unchecked.reduce((acc, item) => {
    const recipeName = item.recipe_id
      ? recipes?.find((r) => r.id === item.recipe_id)?.title || 'Unknown Recipe'
      : 'No Recipe';
    if (!acc[recipeName]) acc[recipeName] = [];
    acc[recipeName].push(item);
    return acc;
  }, {} as Record<string, typeof unchecked>);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === unchecked.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unchecked.map((i) => i.id)));
    }
  };

  const exportSelectedToKeep = () => {
    const toExport = items?.filter((i) => selectedIds.has(i.id)) || [];
    if (toExport.length === 0) {
      toast.error('Select items to export');
      return;
    }
    const text = toExport
      .map((i) => `${i.quantity || ''} ${i.unit || ''} ${i.ingredient_name}`.trim())
      .join('\n');

    navigator.clipboard.writeText(text).then(() => {
      window.open('https://keep.google.com/#NOTE', '_blank');
      toast.success('Items copied! Paste into Google Keep.');
    }).catch(() => toast.error('Could not copy'));
  };

  const renderItem = (item: typeof unchecked[0], isChecked = false) => (
    <div key={item.id} className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors group">
      {!isChecked && (
        <Checkbox
          checked={selectedIds.has(item.id)}
          onCheckedChange={() => toggleSelect(item.id)}
          className="border-muted-foreground/50"
        />
      )}
      <Checkbox
        checked={isChecked}
        onCheckedChange={() => toggleItem.mutate({ id: item.id, checked: !isChecked })}
      />
      <div className={cn('flex-1 font-body', isChecked && 'line-through text-muted-foreground')}>
        <span className={isChecked ? '' : 'text-foreground'}>{item.ingredient_name}</span>
        {(item.quantity || item.unit) && (
          <span className="text-muted-foreground ml-2 text-sm">{item.quantity} {item.unit}</span>
        )}
      </div>
      <Button
        variant="ghost" size="icon"
        onClick={() => deleteItem.mutate(item.id)}
        className="opacity-0 group-hover:opacity-100 text-destructive h-8 w-8"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Shopping List</h1>
            <p className="text-muted-foreground font-body text-sm mt-1">{items?.length ?? 0} items</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedIds.size > 0 && (
              <Button variant="outline" size="sm" onClick={exportSelectedToKeep} className="gap-1.5">
                <Share2 className="h-4 w-4" /> Google Keep ({selectedIds.size})
              </Button>
            )}
            {checked.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => clearChecked.mutate()} className="gap-1.5">
                <CheckCheck className="h-4 w-4" /> Clear checked
              </Button>
            )}
            {items && items.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => clearAll.mutate()} className="gap-1.5 text-destructive hover:text-destructive">
                <XCircle className="h-4 w-4" /> Clear all
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : items && items.length > 0 ? (
          <>
            {unchecked.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs">
                  {selectedIds.size === unchecked.length ? 'Deselect all' : 'Select all'}
                </Button>
              </div>
            )}

            <Tabs defaultValue="store" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="store">By Store Section</TabsTrigger>
                <TabsTrigger value="recipe">By Recipe</TabsTrigger>
              </TabsList>

              <TabsContent value="store" className="mt-3 space-y-1">
                {Object.entries(bySection)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([section, sectionItems]) => (
                    <div key={section}>
                      <div className="pt-3 pb-1 px-3">
                        <span className="text-xs font-body text-muted-foreground uppercase tracking-wide font-semibold">{section}</span>
                      </div>
                      {sectionItems.map((item) => renderItem(item))}
                    </div>
                  ))}
              </TabsContent>

              <TabsContent value="recipe" className="mt-3 space-y-1">
                {Object.entries(byRecipe).map(([recipeName, recipeItems]) => (
                  <div key={recipeName}>
                    <div className="pt-3 pb-1 px-3">
                      <span className="text-xs font-body text-muted-foreground uppercase tracking-wide font-semibold">{recipeName}</span>
                    </div>
                    {recipeItems.map((item) => renderItem(item))}
                  </div>
                ))}
              </TabsContent>
            </Tabs>

            {checked.length > 0 && (
              <>
                <div className="pt-3 pb-1 px-3">
                  <span className="text-xs font-body text-muted-foreground uppercase tracking-wide">Checked off</span>
                </div>
                {checked.map((item) => renderItem(item, true))}
              </>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/20 text-secondary">
              <ShoppingCart className="h-8 w-8" />
            </div>
            <h2 className="font-display text-xl font-semibold text-foreground">List is empty</h2>
            <p className="text-muted-foreground font-body max-w-sm">
              Open a recipe and click "Add to List" to send ingredients here.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
