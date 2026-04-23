import { ReactNode, useState } from 'react';
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
  Package,
  Share2,
  Folder,
  CalendarDays,
  Menu,
  X,
  RefreshCw,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import ThemeSwitcher from '@/components/ThemeSwitcher';

const mainNav = [
  { to: '/', icon: BookOpen, label: 'Recipes' },
  { to: '/shopping-list', icon: ShoppingCart, label: 'Shopping' },
  { to: '/meal-planner', icon: CalendarDays, label: 'Planner' },
  { to: '/pantry', icon: Package, label: 'Pantry' },
];

const secondaryNav = [
  { to: '/create', icon: PlusCircle, label: 'Create' },
  { to: '/import', icon: Upload, label: 'Import' },
  { to: '/collections', icon: Folder, label: 'Collections' },
  { to: '/sharing', icon: Share2, label: 'Share' },
];

const allNav = [...mainNav, ...secondaryNav];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '';

  const handleResetSiteData = async () => {
    if (!confirm('Wyczyścić cache i service worker, a potem przeładować stronę?')) return;
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (err) {
      console.warn('Reset site data failed:', err);
    } finally {
      // Hard reload, bypassing HTTP cache where supported
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop header */}
      <header className="hidden md:flex items-center justify-between border-b border-border/60 px-6 py-3 bg-card/60 backdrop-blur-md sticky top-0 z-40">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold text-foreground tracking-tight">Recipe Keeper</span>
        </Link>
        <nav className="flex items-center gap-1">
          {allNav.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to}>
                <Button
                  variant={active ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'gap-2 font-body text-sm',
                    active && 'shadow-sm'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
          <div className="w-px h-6 bg-border mx-2" />
          <ThemeSwitcher />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetSiteData}
            className="text-muted-foreground gap-2"
            title="Reset site data (service worker + cache)"
          >
            <RefreshCw className="h-4 w-4" /> Reset cache
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground gap-2">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </nav>
      </header>

      {/* Content */}
      <main className="pb-24 md:pb-8">{children}</main>

      {/* Mobile bottom nav — 4 main items + "More" menu */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur-md md:hidden pb-safe">
        <div className="flex items-stretch justify-around px-1">
          {mainNav.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-2 px-2 min-w-0 flex-1 rounded-xl transition-all font-body',
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground active:text-foreground'
                )}
              >
                <item.icon className={cn('h-5 w-5', active && 'drop-shadow-sm')} />
                <span className={cn('text-[10px] leading-tight', active ? 'font-semibold' : 'font-medium')}>
                  {item.label}
                </span>
                {active && <div className="h-0.5 w-4 rounded-full bg-primary mt-0.5" />}
              </Link>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 py-2 px-2 min-w-0 flex-1 rounded-xl text-muted-foreground font-body active:text-foreground"
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] leading-tight font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile slide-up menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl border-t border-border/60 p-5 pb-safe animate-slide-up">
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />

            {/* User info */}
            {userName && (
              <div className="mb-4 px-1">
                <p className="text-xs text-muted-foreground font-body">Signed in as</p>
                <p className="font-display font-semibold text-foreground truncate">{userName}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {secondaryNav.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3.5 rounded-2xl font-body transition-colors',
                      active
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'bg-muted/60 text-foreground hover:bg-muted'
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-3 px-4 py-3 rounded-2xl bg-muted/60 flex items-center justify-between">
              <span className="font-body text-sm text-foreground">Theme</span>
              <ThemeSwitcher variant="full" className="!text-foreground" />
            </div>

            <button
              onClick={() => { setMobileMenuOpen(false); signOut(); }}
              className="flex items-center gap-3 w-full mt-3 px-4 py-3.5 rounded-2xl font-body text-destructive bg-destructive/5 text-sm"
            >
              <LogOut className="h-5 w-5" />
              Sign out
            </button>

            <button
              onClick={() => { setMobileMenuOpen(false); handleResetSiteData(); }}
              className="flex items-center gap-3 w-full mt-2 px-4 py-3.5 rounded-2xl font-body text-muted-foreground bg-muted/40 hover:bg-muted text-sm"
            >
              <RefreshCw className="h-5 w-5" />
              Reset site data (SW + cache)
            </button>

            <Button
              variant="ghost"
              size="lg"
              className="w-full mt-2 text-muted-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="h-5 w-5 mr-2" /> Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}