export interface ThemeColors {
  cardBackground: string; // Input box card background (e.g. #303030)
  dialogBackground: string; // Floating dialog panel background (e.g. #242424)
  selectionBackground: string; // Active item highlight background (e.g. #3a3a3a)
  text: string; // Primary text (e.g. #ffffff)
  textMuted: string; // Secondary / muted text (e.g. #a3a3a3)
  textDim: string; // Dimmed label text (e.g. #737373)
  accent: string; // Primary blue accent (e.g. #3b82f6)
  accentActive: string; // Active/focused accent (e.g. #60a5fa)
  success: string; // Exit 0 / active status green (e.g. #22c55e)
  error: string; // Failed / error red (e.g. #ef4444)
  warning: string; // Amber thought badge (e.g. #d97706)
  border: string; // Inactive card border (e.g. #525252)
  borderActive: string; // Active card border (e.g. #3b82f6)
}

export interface Theme {
  name: string;
  isDark: boolean;
  colors: ThemeColors;
}
