/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Crimson Pro', 'Georgia', 'serif'],
        ui: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      colors: {
        'duck-bg-void': '#07090f',
        'duck-bg-deep': '#0d1117',
        'duck-bg-surface': '#161b22',
        'duck-bg-elevated': '#1c2333',
        'duck-bg-overlay': '#21262d',
        'duck-border': '#30363d',
        'duck-border-muted': '#21262d',
        'duck-yellow': '#fbbf24',
        'duck-yellow-dim': '#d97706',
        'duck-orange': '#f97316',
        'duck-red': '#ef4444',
        'duck-green': '#22c55e',
        'duck-cyan': '#06b6d4',
        'duck-purple': '#a855f7',
      },
    },
  },
  plugins: [],
}
