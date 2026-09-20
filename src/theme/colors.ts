/**
 * Theme palette with TrueColor RGB and ANSI fallbacks.
 */
export interface UITheme {
  brand: string;
  brandShimmer: string;
  permission: string;
  permissionDim: string;
  permissionShimmer: string;
  lavenderHeader: string;
  lavenderLight: string;
  bashPink: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  bulletSuccess: string;
  bulletError: string;
  bulletRunning: string;
  text: string;
  textMuted: string;
  subtle: string;
  inactive: string;
  promptBorder: string;
  userCardBg: string;
  userChevron: string;
  toolHeaderBg: string;
  diffAddBG: string;
  diffAddFG: string;
  diffDeleteBG: string;
  diffDeleteFG: string;
  dividerRule: string;
  dashedRule: string;
}

export type ThemeName =
  | 'dark'
  | 'light'
  | 'dark-ansi'
  | 'light-ansi'
  | 'dark-colorblind'
  | 'light-colorblind'
  | 'dracula';

export interface ThemeMeta {
  name: ThemeName;
  label: string;
  description: string;
  theme: UITheme;
}

export const darkTheme: UITheme = {
  brand: 'rgb(215,119,87)', // Brand terracotta / coral (#D77757)
  brandShimmer: 'rgb(235,159,127)',
  permission: 'rgb(177,185,249)', // Soft blue-purple (#B1B9F9)
  permissionDim: 'rgb(93,100,128)',
  permissionShimmer: 'rgb(207,215,255)',
  lavenderHeader: 'rgb(129,136,165)', // #8188A5
  lavenderLight: 'rgb(183,184,228)', // #B7B8E4
  bashPink: 'rgb(253,93,177)', // Vibrant pink for bash mode (#FD5DB1)
  success: 'rgb(78,186,101)', // Green (#4EBA65)
  error: 'rgb(255,107,128)', // Red (#FF6B80)
  warning: 'rgb(255,193,7)', // Amber (#FFC107)
  info: 'rgb(123,165,218)', // Info sky blue (#7BA5DA)
  bulletSuccess: 'rgb(75,185,99)', // #4BB963 (green for completed)
  bulletError: 'rgb(255,107,128)', // #FF6B80 (red for error/interrupted)
  bulletRunning: 'rgb(255,255,255)', // #FFFFFF (white for in-progress)
  text: 'rgb(255,255,255)', // White
  textMuted: 'rgb(110,110,110)', // #6E6E6E
  subtle: 'rgb(80,80,80)', // Dark gray (#505050)
  inactive: 'rgb(153,153,153)', // Muted gray
  promptBorder: 'rgb(136,136,136)', // #888888
  userCardBg: 'rgb(55,55,55)', // #373737
  userChevron: 'rgb(82,82,82)', // #525252
  toolHeaderBg: 'rgb(35,35,40)',
  diffAddBG: 'rgb(19,54,14)', // #13360E
  diffAddFG: 'rgb(126,231,135)', // #7EE787
  diffDeleteBG: 'rgb(54,5,9)', // #360509
  diffDeleteFG: 'rgb(255,123,114)', // #FF7B72
  dividerRule: 'rgb(129,136,165)',
  dashedRule: 'rgb(51,51,51)',
};

export const lightTheme: UITheme = {
  brand: 'rgb(215,119,87)',
  brandShimmer: 'rgb(245,149,117)',
  permission: 'rgb(87,105,247)',
  permissionDim: 'rgb(140,150,200)',
  permissionShimmer: 'rgb(137,155,255)',
  lavenderHeader: 'rgb(100,110,145)',
  lavenderLight: 'rgb(120,130,190)',
  bashPink: 'rgb(219,39,119)',
  success: 'rgb(44,122,57)',
  error: 'rgb(171,43,63)',
  warning: 'rgb(150,108,30)',
  info: 'rgb(40,100,180)',
  bulletSuccess: 'rgb(44,122,57)',
  bulletError: 'rgb(171,43,63)',
  bulletRunning: 'rgb(20,20,20)',
  text: 'rgb(0,0,0)',
  textMuted: 'rgb(120,120,120)',
  subtle: 'rgb(175,175,175)',
  inactive: 'rgb(102,102,102)',
  promptBorder: 'rgb(153,153,153)',
  userCardBg: 'rgb(240,240,240)',
  userChevron: 'rgb(160,160,160)',
  toolHeaderBg: 'rgb(230,230,235)',
  diffAddBG: 'rgb(220,245,220)',
  diffAddFG: 'rgb(30,120,40)',
  diffDeleteBG: 'rgb(255,230,230)',
  diffDeleteFG: 'rgb(180,40,40)',
  dividerRule: 'rgb(120,130,160)',
  dashedRule: 'rgb(200,200,200)',
};

export const draculaTheme: UITheme = {
  brand: 'rgb(255,184,108)', // Orange
  brandShimmer: 'rgb(255,200,140)',
  permission: 'rgb(189,147,249)', // Purple
  permissionDim: 'rgb(98,114,164)', // Comment
  permissionShimmer: 'rgb(255,121,198)', // Pink
  lavenderHeader: 'rgb(189,147,249)', // Purple
  lavenderLight: 'rgb(215,190,252)',
  bashPink: 'rgb(255,121,198)', // Pink
  success: 'rgb(80,250,123)', // Green
  error: 'rgb(255,85,85)', // Red
  warning: 'rgb(255,184,108)', // Orange
  info: 'rgb(139,233,253)', // Cyan
  bulletSuccess: 'rgb(80,250,123)',
  bulletError: 'rgb(255,85,85)',
  bulletRunning: 'rgb(248,248,242)', // Foreground
  text: 'rgb(248,248,242)', // Foreground
  textMuted: 'rgb(98,114,164)', // Comment
  subtle: 'rgb(68,71,90)', // Current Line
  inactive: 'rgb(98,114,164)',
  promptBorder: 'rgb(98,114,164)',
  userCardBg: 'rgb(68,71,90)', // Current Line
  userChevron: 'rgb(98,114,164)',
  toolHeaderBg: 'rgb(40,42,54)', // Background
  diffAddBG: 'rgb(12,38,18)',
  diffAddFG: 'rgb(80,250,123)',
  diffDeleteBG: 'rgb(45,15,15)',
  diffDeleteFG: 'rgb(255,85,85)',
  dividerRule: 'rgb(189,147,249)',
  dashedRule: 'rgb(68,71,90)',
};

export const darkAnsiTheme: UITheme = {
  brand: 'ansi(yellow)',
  brandShimmer: 'ansi(yellowBright)',
  permission: 'ansi(blue)',
  permissionDim: 'ansi(gray)',
  permissionShimmer: 'ansi(blueBright)',
  lavenderHeader: 'ansi(magenta)',
  lavenderLight: 'ansi(magentaBright)',
  bashPink: 'ansi(magenta)',
  success: 'ansi(green)',
  error: 'ansi(red)',
  warning: 'ansi(yellow)',
  info: 'ansi(cyan)',
  bulletSuccess: 'ansi(green)',
  bulletError: 'ansi(red)',
  bulletRunning: 'ansi(white)',
  text: 'ansi(white)',
  textMuted: 'ansi(gray)',
  subtle: 'ansi(gray)',
  inactive: 'ansi(gray)',
  promptBorder: 'ansi(gray)',
  userCardBg: 'ansi(bgBlackBright)',
  userChevron: 'ansi(gray)',
  toolHeaderBg: 'ansi(bgBlack)',
  diffAddBG: 'ansi(reset)',
  diffAddFG: 'ansi(green)',
  diffDeleteBG: 'ansi(reset)',
  diffDeleteFG: 'ansi(red)',
  dividerRule: 'ansi(magenta)',
  dashedRule: 'ansi(gray)',
};

export const lightAnsiTheme: UITheme = {
  brand: 'ansi(yellow)',
  brandShimmer: 'ansi(yellowBright)',
  permission: 'ansi(blue)',
  permissionDim: 'ansi(gray)',
  permissionShimmer: 'ansi(blueBright)',
  lavenderHeader: 'ansi(magenta)',
  lavenderLight: 'ansi(magentaBright)',
  bashPink: 'ansi(magenta)',
  success: 'ansi(green)',
  error: 'ansi(red)',
  warning: 'ansi(yellow)',
  info: 'ansi(blue)',
  bulletSuccess: 'ansi(green)',
  bulletError: 'ansi(red)',
  bulletRunning: 'ansi(black)',
  text: 'ansi(black)',
  textMuted: 'ansi(gray)',
  subtle: 'ansi(gray)',
  inactive: 'ansi(gray)',
  promptBorder: 'ansi(gray)',
  userCardBg: 'ansi(bgWhiteBright)',
  userChevron: 'ansi(gray)',
  toolHeaderBg: 'ansi(bgWhite)',
  diffAddBG: 'ansi(reset)',
  diffAddFG: 'ansi(green)',
  diffDeleteBG: 'ansi(reset)',
  diffDeleteFG: 'ansi(red)',
  dividerRule: 'ansi(magenta)',
  dashedRule: 'ansi(gray)',
};

export const darkColorblindTheme: UITheme = {
  brand: 'rgb(86,180,233)', // Sky Blue
  brandShimmer: 'rgb(136,200,245)',
  permission: 'rgb(0,114,178)', // Blue
  permissionDim: 'rgb(93,100,128)',
  permissionShimmer: 'rgb(86,180,233)',
  lavenderHeader: 'rgb(204,121,167)', // Reddish Purple
  lavenderLight: 'rgb(220,150,190)',
  bashPink: 'rgb(204,121,167)',
  success: 'rgb(0,158,115)', // Bluish Green
  error: 'rgb(213,94,0)', // Vermillion
  warning: 'rgb(230,159,0)', // Orange
  info: 'rgb(0,114,178)', // Blue
  bulletSuccess: 'rgb(0,158,115)',
  bulletError: 'rgb(213,94,0)',
  bulletRunning: 'rgb(255,255,255)',
  text: 'rgb(255,255,255)',
  textMuted: 'rgb(110,110,110)',
  subtle: 'rgb(80,80,80)',
  inactive: 'rgb(153,153,153)',
  promptBorder: 'rgb(136,136,136)',
  userCardBg: 'rgb(55,55,55)',
  userChevron: 'rgb(82,82,82)',
  toolHeaderBg: 'rgb(35,35,40)',
  diffAddBG: 'rgb(0,35,25)',
  diffAddFG: 'rgb(0,158,115)',
  diffDeleteBG: 'rgb(45,20,0)',
  diffDeleteFG: 'rgb(213,94,0)',
  dividerRule: 'rgb(204,121,167)',
  dashedRule: 'rgb(51,51,51)',
};

export const lightColorblindTheme: UITheme = {
  brand: 'rgb(0,114,178)', // Blue
  brandShimmer: 'rgb(86,180,233)', // Sky Blue
  permission: 'rgb(0,114,178)', // Blue
  permissionDim: 'rgb(140,150,200)',
  permissionShimmer: 'rgb(86,180,233)',
  lavenderHeader: 'rgb(204,121,167)', // Reddish Purple
  lavenderLight: 'rgb(220,150,190)',
  bashPink: 'rgb(204,121,167)',
  success: 'rgb(0,158,115)', // Bluish Green
  error: 'rgb(213,94,0)', // Vermillion
  warning: 'rgb(230,159,0)', // Orange
  info: 'rgb(0,114,178)', // Blue
  bulletSuccess: 'rgb(0,158,115)',
  bulletError: 'rgb(213,94,0)',
  bulletRunning: 'rgb(20,20,20)',
  text: 'rgb(0,0,0)',
  textMuted: 'rgb(120,120,120)',
  subtle: 'rgb(175,175,175)',
  inactive: 'rgb(102,102,102)',
  promptBorder: 'rgb(153,153,153)',
  userCardBg: 'rgb(240,240,240)',
  userChevron: 'rgb(160,160,160)',
  toolHeaderBg: 'rgb(230,230,235)',
  diffAddBG: 'rgb(215,245,235)',
  diffAddFG: 'rgb(0,158,115)',
  diffDeleteBG: 'rgb(255,235,225)',
  diffDeleteFG: 'rgb(213,94,0)',
  dividerRule: 'rgb(204,121,167)',
  dashedRule: 'rgb(200,200,200)',
};

export const THEMES: Record<ThemeName, ThemeMeta> = {
  dark: {
    name: 'dark',
    label: 'Dark (Default)',
    description: 'Default dark theme with terracotta and purple accents',
    theme: darkTheme,
  },
  light: {
    name: 'light',
    label: 'Light',
    description: 'Clean light palette optimized for light backgrounds',
    theme: lightTheme,
  },
  'dark-ansi': {
    name: 'dark-ansi',
    label: 'Dark ANSI',
    description: '16-color ANSI palette respecting your terminal theme',
    theme: darkAnsiTheme,
  },
  'light-ansi': {
    name: 'light-ansi',
    label: 'Light ANSI',
    description: '16-color ANSI light palette respecting terminal colors',
    theme: lightAnsiTheme,
  },
  'dark-colorblind': {
    name: 'dark-colorblind',
    label: 'Dark Colorblind',
    description: 'Okabe–Ito colorblind-accessible dark theme',
    theme: darkColorblindTheme,
  },
  'light-colorblind': {
    name: 'light-colorblind',
    label: 'Light Colorblind',
    description: 'Okabe–Ito colorblind-accessible light theme',
    theme: lightColorblindTheme,
  },
  dracula: {
    name: 'dracula',
    label: 'Dracula',
    description: 'Official gothic-inspired vampire color scheme',
    theme: draculaTheme,
  },
};

let activeThemeName: ThemeName = 'dark';

/**
 * Returns active theme name.
 */
export function getActiveThemeName(): ThemeName {
  return activeThemeName;
}

/**
 * Safely sets the active theme in memory.
 * No-ops if the provided theme name is unknown.
 */
export function setActiveTheme(name: string): void {
  if (name in THEMES) {
    activeThemeName = name as ThemeName;
  }
}

/**
 * Returns active theme.
 */
export function getTheme(): UITheme {
  return THEMES[activeThemeName]?.theme ?? darkTheme;
}

/**
 * Returns list of all available themes.
 */
export function listThemes(): ThemeMeta[] {
  return Object.values(THEMES);
}

/**
 * Finds a theme by name, label, or prefix (case-insensitive).
 */
export function findTheme(query: string): ThemeMeta | undefined {
  const q = query
    .trim()
    .toLowerCase()
    .replace(/^["']|["']$/g, '');
  if (!q) return undefined;
  return listThemes().find(
    (t) =>
      t.name.toLowerCase() === q ||
      t.label.toLowerCase() === q ||
      t.label.toLowerCase().startsWith(q),
  );
}
