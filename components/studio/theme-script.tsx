export function ThemeScript() {
  const script = `
    (() => {
      const key = 'prompt-chain-theme';
      const stored = window.localStorage.getItem(key);
      const mode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const resolved = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
      document.documentElement.dataset.theme = mode;
      document.documentElement.classList.toggle('dark', resolved === 'dark');
      document.documentElement.style.colorScheme = resolved;
    })();
  `

  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
