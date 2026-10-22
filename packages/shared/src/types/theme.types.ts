export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  textMuted: string;
  border?: string;
  glow?: string;
}

export interface ThemeEffects {
  glassmorphism: boolean;
  shadows: boolean;
  gradients: boolean;
  blur?: string;
}

export interface ThemeTypography {
  fontFamily: string;
  fontSize: {
    base: string;
    sm: string;
    lg: string;
    xl: string;
  };
}

export interface Theme {
  name: string;
  displayName: string;
  description: string;
  colors: ThemeColors;
  effects: ThemeEffects;
  typography?: ThemeTypography;
  sidebarWidth?: string;
}
