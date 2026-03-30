import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useMyShares, useShareRecipes, useRemoveShare } from '@/hooks/useRecipeSharing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Share2, UserPlus, Trash2, Users } from 'lucide-react';

export default function Sharing() {
  const { data: shares, isLoading } = useMyShares();
  const shareRecipes = useShareRecipes();
  const removeShare = useRemoveShare();
  const [email, setEmail] = useState('');

  const handleShare = async () => {
    if (!email.trim()) return;
    try {
      await shareRecipes.mutateAsync(email.trim());
      toast.success(`Shared your cookbook with ${email}`);
      setEmail('');
    } catch (err: any) {
      if (err?.message?.includes('duplicate')) {
        toast.error('Already shared with this person');
      } else {
        toast.error('Failed to share');
      }
    }
  };

  const handleRemove = async (id: string, shareEmail: string) => {
    try {
      await removeShare.mutateAsync(id);
      toast.success(`Removed ${shareEmail}`);
    } catch {
      toast.error('Failed to remove');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Share Recipes</h1>
          <p className="text-muted-foreground font-body text-sm mt-1">
            Share your entire cookbook with family or friends. They'll see all your recipes and any updates you make.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Invite Someone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter their email address"
                onKeyDown={(e) => e.key === 'Enter' && handleShare()}
              />
              <Button onClick={handleShare} disabled={!email.trim() || shareRecipes.isPending} className="gap-1.5 shrink-0">
                <Share2 className="h-4 w-4" /> Share
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 font-body">
              They need to have an account with this email to see your recipes.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Users className="h-5 w-5" /> Shared With
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div>
            ) : shares && shares.length > 0 ? (
              <ul className="space-y-2">
                {shares.map((share) => (
                  <li key={share.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                    <span className="font-body text-foreground">{share.shared_with_email}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive h-8 w-8"
                      onClick={() => handleRemove(share.id, share.shared_with_email)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm font-body">You haven't shared your recipes with anyone yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
