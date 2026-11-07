export const themes = {
  luxury: {
    name: 'Luxury Gold VIP',
    variables: {
      '--theme-store-ink': '#271f1a',
      '--theme-store-muted': '#83776c',
      '--theme-store-paper': '#f5f1e9',
      '--theme-store-card': '#fffdf8',
      '--theme-store-line': '#e6ddd0',
      '--theme-store-wine': '#663b38',
      '--theme-store-gold': '#b58b51'
    }
  },
  cyberpunk: {
    name: 'Cyberpunk Neon',
    variables: {
      '--theme-store-ink': '#f8fafc',
      '--theme-store-muted': '#94a3b8',
      '--theme-store-paper': '#090d16',
      '--theme-store-card': 'rgba(30, 41, 59, 0.8)',
      '--theme-store-line': 'rgba(255, 255, 255, 0.12)',
      '--theme-store-wine': '#a855f7',
      '--theme-store-gold': '#06b6d4'
    }
  }
};

export const defaultTheme = themes.luxury;

export const cyberpunkTheme = {
  colors: {
    bgDark: '#090d16',
    cardGlass: 'rgba(30, 41, 59, 0.5)',
    borderGlass: 'rgba(255, 255, 255, 0.08)',
    neonCyan: '#06b6d4',
    neonPurple: '#a855f7',
    neonPink: '#ec4899',
    textMain: '#f8fafc',
    textMuted: '#94a3b8'
  },
  gradients: {
    primary: 'linear-gradient(135deg, #06b6d4, #a855f7)',
    explosive: 'linear-gradient(135deg, #06b6d4, #a855f7, #ec4899)'
  }
};
