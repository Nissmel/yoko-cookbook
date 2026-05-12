// Maps recipe.source_url → a short, human-friendly source label.
// Recipes without a source_url were created manually ("Added by me").

const HOST_LABELS: Record<string, string> = {
  'mojewypieki.com': 'Moje Wypieki',
  'aniagotuje.pl': 'Ania Gotuje',
  'kwestiasmaku.com': 'Kwestia Smaku',
  'justonecookbook.com': 'Just One Cookbook',
  'recipetineats.com': 'RecipeTin Eats',
};

export function getRecipeSourceLabel(sourceUrl: string | null | undefined): string {
  if (!sourceUrl) return 'Added by me';
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, '');
    if (HOST_LABELS[host]) return HOST_LABELS[host];
    // Fall back to a tidy hostname (strip leading subdomain segments except www).
    return host.replace(/\.(com|pl|net|org|io|co|uk|eu)$/i, '');
  } catch {
    return 'Added by me';
  }
}

export function isOwnRecipe(sourceUrl: string | null | undefined): boolean {
  return !sourceUrl;
}
