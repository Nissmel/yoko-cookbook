import AppLayout from '@/components/AppLayout';
import { useShoppingList, useToggleShoppingItem, useDeleteShoppingItem, useClearCheckedItems } from '@/hooks/useShoppingList';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, ShoppingCart, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ShoppingList() {
  const { data: items, isLoading } = useShoppingList();
  const toggleItem = useToggleShoppingItem();
  const deleteItem = useDeleteShoppingItem();
  const clearChecked = useClearCheckedItems();

  const unchecked = items?.filter((i) => !i.checked) || [];
  const checked = items?.filter((i) => i.checked) || [];

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Shopping List</h1>
            <p className="text-muted-foreground font-body text-sm mt-1">
              {items?.length ?? 0} items
            </p>
          </div>
          {checked.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => clearChecked.mutate()} className="gap-1.5">
              <CheckCheck className="h-4 w-4" /> Clear checked
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <div className="space-y-1">
            {unchecked.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors group">
                <Checkbox
                  checked={false}
                  onCheckedChange={() => toggleItem.mutate({ id: item.id, checked: true })}
                />
                <div className="flex-1 font-body">
                  <span className="text-foreground">{item.ingredient_name}</span>
                  {(item.quantity || item.unit) && (
                    <span className="text-muted-foreground ml-2 text-sm">
                      {item.quantity} {item.unit}
                    </span>
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
            ))}
            {checked.length > 0 && (
              <>
                <div className="pt-3 pb-1 px-3">
                  <span className="text-xs font-body text-muted-foreground uppercase tracking-wide">Checked off</span>
                </div>
                {checked.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors group">
                    <Checkbox
                      checked={true}
                      onCheckedChange={() => toggleItem.mutate({ id: item.id, checked: false })}
                    />
                    <div className={cn('flex-1 font-body line-through text-muted-foreground')}>
                      <span>{item.ingredient_name}</span>
                      {(item.quantity || item.unit) && (
                        <span className="ml-2 text-sm">{item.quantity} {item.unit}</span>
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
                ))}
              </>
            )}
          </div>
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
