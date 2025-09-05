/**
 * Toggles the website theme between 'light' and 'dark' modes. This is done by
 * updating the document's data-theme attribute and saves the selected theme to
 * localStorage. The rest is handled by CSS.
 */
export function toggleTheme(): void {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem('theme', next);
}

/**
 * Restores the user's previously selected theme from localStorage and applies
 * it to the document. If no theme is saved, the theme remains unchanged.
 */
export function restoreTheme(): void {
    const root = document.documentElement;
    const saved = localStorage.getItem('theme');
    if (saved) root.dataset.theme = saved;
}
