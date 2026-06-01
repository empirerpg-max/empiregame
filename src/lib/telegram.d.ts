// Tipos globais do Telegram WebApp — arquivo separado para evitar
// conflito de binding do Rollup com declare global inline em .ts

type HapticImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type HapticNotificationType = "error" | "success" | "warning";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close?: () => void;
        setHeaderColor?: (c: string) => void;
        setBackgroundColor?: (c: string) => void;
        openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
        openTelegramLink?: (url: string) => void;
        initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string; photo_url?: string } };
        colorScheme?: "light" | "dark";
        themeParams?: Record<string, string>;
        onEvent?: (event: string, cb: () => void) => void;
        offEvent?: (event: string, cb: () => void) => void;
        BackButton?: {
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
        MainButton?: {
          text: string;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
          setText: (t: string) => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
        };
        HapticFeedback?: {
          impactOccurred: (style: HapticImpactStyle) => void;
          notificationOccurred: (type: HapticNotificationType) => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

export {};
