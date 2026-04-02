import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useCollections, useCreateCollection, useDeleteCollection, useCollectionRecipes } from '@/hooks/useCollections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FolderPlus, Folder, Trash2, ChevronRight, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

function CollectionDetail({ collectionId, collectionName, onBack }: { collectionId: string; collectionName: string; onBack: () => void }) {
  const { data: recipes, isLoading } = useCollectionRecipes(collectionId);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Collections
      </button>
      <h2 className="font-display text-2xl font-bold">{collectionName}</h2>
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded animate-pulse" />)}</div>
      ) : recipes && recipes.length > 0 ? (
        <div className="space-y-2">
          {recipes.map((recipe: any) => (
            <Link key={recipe.id} to={`/recipe/${recipe.id}`} className="block">
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-3 flex items-center gap-3">
                  {recipe.image_url && <img src={recipe.image_url} alt={recipe.title} className="w-12 h-12 rounded-lg object-cover" />}
                  <div>
                    <p className="font-display font-semibold">{recipe.title}</p>
                    {recipe.category && <p className="text-xs text-muted-foreground">{recipe.category}</p>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No recipes in this collection yet. Add recipes from the recipe detail page.</p>
      )}
    </div>
  );
}

export default function Collections() {
  const { data: collections, isLoading } = useCollections();
  const createCollection = useCreateCollection();
  const deleteCollection = useDeleteCollection();
  const [name, setName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<{ id: string; name: string } | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await createCollection.mutateAsync({ name: name.trim() });
      toast.success('Collection created!');
      setName('');
      setDialogOpen(false);
    } catch {
      toast.error('Failed to create collection');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteCollection.mutateAsync(id);
      toast.success('Collection deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 space-y-6 animate-fade-in">
        {selectedCollection ? (
          <CollectionDetail
            collectionId={selectedCollection.id}
            collectionName={selectedCollection.name}
            onBack={() => setSelectedCollection(null)}
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-3xl font-bold text-foreground">Collections</h1>
                <p className="text-muted-foreground font-body text-sm mt-1">Organize your recipes into folders.</p>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-1.5"><FolderPlus className="h-4 w-4" /> New</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-display">New Collection</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Collection name"
                      onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    />
                    <Button onClick={handleCreate} disabled={!name.trim()} className="w-full">Create</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {isLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded animate-pulse" />)}</div>
            ) : collections && collections.length > 0 ? (
              <div className="space-y-2">
                {collections.map((col) => (
                  <Card
                    key={col.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setSelectedCollection({ id: col.id, name: col.name })}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Folder className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-display font-semibold">{col.name}</p>
                          <p className="text-xs text-muted-foreground">{col.recipe_count} recipe{col.recipe_count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => handleDelete(e, col.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground font-body">No collections yet. Create one to organize your recipes!</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
