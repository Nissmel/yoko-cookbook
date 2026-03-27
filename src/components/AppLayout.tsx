import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  UtensilsCrossed,
  BookOpen,
  PlusCircle,
  ShoppingCart,
  LogOut,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: BookOpen, label: 'Recipes' },
  { to: '/create', icon: PlusCircle, label: 'Create' },
  { to: '/import', icon: Upload, label: 'Import' },
  { to: '/shopping-list', icon: ShoppingCart, label: 'Shopping' },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop header */}
      <header className="hidden md:flex items-center justify-between border-b border-border px-6 py-3 bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold text-foreground">Recipe Keeper</span>
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to}>
              <Button
                variant={location.pathname === item.to ? 'default' : 'ghost'}
                size="sm"
                className="gap-2"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          ))}
          <Button variant="ghost" size="sm" onClick={signOut} className="ml-2 text-muted-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </nav>
      </header>

      {/* Content */}
      <main className="pb-20 md:pb-8">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur-sm px-2 py-2 md:hidden">
        {navItems.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-body transition-colors',
                active ? 'text-primary bg-primary/10' : 'text-muted-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={signOut}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-body text-muted-foreground"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </nav>
    </div>
  );
}
