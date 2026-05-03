import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useShoppingList, useToggleShoppingItem, useDeleteShoppingItem, useClearCheckedItems, useClearAllItems } from '@/hooks/useShoppingList';
import { useRecipes } from '@/hooks/useRecipes';
import { useSharedWithMe } from '@/hooks/useRecipeSharing';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, ShoppingCart, CheckCheck, Share2, XCircle, Eye, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getStoreSection } from '@/types/recipe';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export default function ShoppingList() {
  const { data: sharedOwners } = useSharedWithMe();
  const [viewingOwnerId, setViewingOwnerId] = useState<string>('me');
  const isViewingOwn = viewingOwnerId === 'me';
  const targetOwnerId = isViewingOwn ? undefined : viewingOwnerId;

  const { data: items, isLoading } = useShoppingList(targetOwnerId);
  const { data: recipes } = useRecipes();
  const toggleItem = useToggleShoppingItem();
  const deleteItem = useDeleteShoppingItem();
  const clearChecked = useClearCheckedItems();
  const clearAll = useClearAllItems();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [consolidating, setConsolidating] = useState(false);
  const queryClient = useQueryClient();

  const consolidateWithAI = async () => {
    setConsolidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('consolidate-shopping-list', {
        body: { owner_id: targetOwnerId },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      if (data?.merged > 0) {
        toast.success(`Merged ${data.merged} items into ${data.groups} groups`);
      } else {
        toast.info('Nothing to merge 🎉');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to consolidate list');
    } finally {
      setConsolidating(false);
    }
  };

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

  const shareShoppingList = async () => {
    const toExport = selectedIds.size > 0
      ? items?.filter((i) => selectedIds.has(i.id)) || []
      : unchecked;

    if (toExport.length === 0) {
      toast.error('No items to export');
      return;
    }

    const today = new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' });
    const title = `🛒 Lista zakupów — ${today}`;

    const grouped = toExport.reduce((acc, item) => {
      const section = getStoreSection(item.ingredient_name);
      if (!acc[section]) acc[section] = [];
      acc[section].push(item);
      return acc;
    }, {} as Record<string, typeof toExport>);

    let text = '';
    Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([section, sectionItems]) => {
        text += `── ${section} ──\n`;
        sectionItems.forEach((i) => {
          text += `☐ ${i.quantity || ''} ${i.unit || ''} ${i.ingredient_name}`.trim() + '\n';
        });
        text += '\n';
      });

    const finalText = text.trim();

    // Try native Share API (works great on mobile — can share directly to Keep, WhatsApp, etc.)
    if (navigator.share) {
      try {
        await navigator.share({ title, text: finalText });
        toast.success('Shared!');
        return;
      } catch (e: any) {
        if (e.name === 'AbortError') return; // user cancelled
      }
    }

    // Desktop fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(`${title}\n\n${finalText}`);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = `${title}\n\n${finalText}`;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    toast.success('List copied to clipboard! Paste it anywhere (Ctrl+V).');
  };

  const renderItem = (item: typeof unchecked[0], isChecked = false) => (
    <div
      key={item.id}
      className="flex items-start gap-3 px-3 py-3 rounded-lg transition-colors group hover:bg-muted/50 cursor-pointer"
      onClick={() => toggleItem.mutate({ id: item.id, checked: !isChecked })}
    >
      <Checkbox
        checked={isChecked}
        onCheckedChange={() => toggleItem.mutate({ id: item.id, checked: !isChecked })}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5"
      />
      <div className={cn('flex-1 min-w-0 font-body', isChecked && 'line-through text-muted-foreground')}>
        <span className={cn('block break-words', isChecked ? '' : 'text-foreground')}>{item.ingredient_name}</span>
        {(item.quantity || item.unit) && (
          <span className="block text-muted-foreground text-xs mt-0.5">{item.quantity} {item.unit}</span>
        )}
      </div>
      <Button
        variant="ghost" size="icon"
        onClick={(e) => { e.stopPropagation(); deleteItem.mutate(item.id); }}
        className="md:opacity-0 md:group-hover:opacity-100 text-destructive h-8 w-8 shrink-0 -mt-0.5"
        aria-label="Delete item"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  const ownerLabel = (() => {
    if (isViewingOwn) return null;
    const owner = sharedOwners?.find((o) => o.recipe_owner_id === viewingOwnerId);
    return owner?.owner_display_name || owner?.owner_email || 'Shared list';
  })();

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Shopping List</h1>
            <p className="text-muted-foreground font-body text-sm mt-1 flex items-center gap-1">
              {ownerLabel ? <><Eye className="h-3 w-3" />{ownerLabel} · {items?.length ?? 0} items</> : `${items?.length ?? 0} items`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {sharedOwners && sharedOwners.length > 0 && (
              <Select value={viewingOwnerId} onValueChange={(v) => { setViewingOwnerId(v); setSelectedIds(new Set()); }}>
                <SelectTrigger className="h-9 w-auto min-w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">My list</SelectItem>
                  {sharedOwners.map((o) => (
                    <SelectItem key={o.recipe_owner_id} value={o.recipe_owner_id}>
                      {o.owner_display_name || o.owner_email || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={shareShoppingList} className="gap-1.5">
              <Share2 className="h-4 w-4" /> Share {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </Button>
            {items && items.length >= 2 && (
              <Button variant="outline" size="sm" onClick={consolidateWithAI} disabled={consolidating} className="gap-1.5">
                {consolidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Merge with AI
              </Button>
            )}
            {checked.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => clearChecked.mutate(targetOwnerId)} className="gap-1.5">
                <CheckCheck className="h-4 w-4" /> Clear checked
              </Button>
            )}
            {items && items.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => clearAll.mutate(targetOwnerId)} className="gap-1.5 text-destructive hover:text-destructive">
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
              <TabsList className="grid w-full grid-cols-2 h-auto">
                <TabsTrigger value="store" className="text-xs sm:text-sm whitespace-normal py-2 leading-tight">By store</TabsTrigger>
                <TabsTrigger value="recipe" className="text-xs sm:text-sm whitespace-normal py-2 leading-tight">By recipe</TabsTrigger>
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
