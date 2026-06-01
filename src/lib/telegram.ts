import { useEffect, useRef, useState } from "react";

// ---------- Tipos mínimos do Telegram WebApp ----------
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
        initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string } };
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

// ---------- Helpers de UX nativa ----------
const tg = () => (typeof window !== "undefined" ? window.Telegram?.WebApp : undefined);

export const haptic = {
  light: () => tg()?.HapticFeedback?.impactOccurred("light"),
  medium: () => tg()?.HapticFeedback?.impactOccurred("medium"),
  heavy: () => tg()?.HapticFeedback?.impactOccurred("heavy"),
  selection: () => tg()?.HapticFeedback?.selectionChanged(),
  success: () => tg()?.HapticFeedback?.notificationOccurred("success"),
  error: () => tg()?.HapticFeedback?.notificationOccurred("error"),
  warning: () => tg()?.HapticFeedback?.notificationOccurred("warning"),
};

/** Abre links externos respeitando o contexto do Telegram WebApp */
export function openExternal(url: string) {
  const w = tg();
  if (w?.openLink) {
    w.openLink(url, { try_instant_view: false });
  } else if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Hook para mostrar/ocultar o BackButton nativo do Telegram */
export function useTelegramBackButton(show: boolean, onClick: () => void) {
  useEffect(() => {
    const bb = tg()?.BackButton;
    if (!bb) return;
    if (show) {
      bb.show();
      bb.onClick(onClick);
      return () => {
        bb.offClick(onClick);
        bb.hide();
      };
    } else {
      bb.hide();
    }
  }, [show, onClick]);
}

// ---------- Hook principal ----------
export interface TgUser {
  id: string;
  name?: string;
  username?: string;
  photo_url?: string;
  isTest: boolean;
}

// FIX: lê/grava localStorage com try/catch — WebView do Telegram pode lançar
// SecurityError silencioso em alguns dispositivos Android ao acessar storage.
function safeLocalGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeLocalSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
}

export function useTelegramUser(): {
  user: TgUser | null;
  ready: boolean;
  setUserManually: (id: string, name?: string) => void;
} {
  // FIX: usa null como estado inicial e só sobe para um valor real uma única vez.
  // Antes, o estado transitava null → { id: 'guest' } → { id: real } causando
  // 2-3 remontagens do WebSocket do chat na inicialização.
  const [user, setUser] = useState<TgUser | null>(null);
  const [ready, setReady] = useState(false);
  // Guard: impede setar o usuário mais de uma vez após o ready
  const resolvedRef = useRef(false);

  function resolve(u: TgUser) {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setUser(u);
    setReady(true);
  }

  const setUserManually = (id: string, name?: string) => {
    const newUser = { id, name: name || "Usuário Manual", isTest: true };
    safeLocalSet("tg_user_cache", JSON.stringify(newUser));
    resolve(newUser);
  };

  const userFromInitData = (str: string) => {
    try {
      const p = new URLSearchParams(str);
      const u = p.get("user");
      if (u) return JSON.parse(u);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const urlId =
      params.get("id") ||
      params.get("tg_id") ||
      params.get("user_id") ||
      params.get("uid") ||
      params.get("telegram_id") ||
      params.get("tgid");

    const nameFromUrl =
      params.get("name") ||
      params.get("username") ||
      params.get("first_name") ||
      params.get("user_name");

    if (urlId) {
      const newUser = {
        id: urlId,
        name: nameFromUrl || "Usuário #" + urlId.slice(-4),
        isTest: true,
      };
      safeLocalSet("tg_user_cache", JSON.stringify(newUser));
      resolve(newUser);
      return;
    }

    let attempts = 0;
    const maxAttempts = 20;

    const checkUser = () => {
      attempts++;
      const w = window.Telegram?.WebApp;
      const sdkUser = w?.initDataUnsafe?.user;

      if (sdkUser) {
        const newUser: TgUser = {
          id: String(sdkUser.id),
          name: sdkUser.first_name || sdkUser.username || "Usuário",
          username: sdkUser.username,
          photo_url: (sdkUser as any).photo_url,
          isTest: false,
        };
        safeLocalSet("tg_user_cache", JSON.stringify(newUser));
        if (w) { w.ready(); w.expand(); }
        resolve(newUser);
        return true;
      }

      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash.includes("?")
        ? window.location.hash.split("?")[1]
        : window.location.hash.slice(1);
      const hashParams = new URLSearchParams(hash);

      const webAppDataStr =
        hashParams.get("tgWebAppData") ||
        searchParams.get("tgWebAppData") ||
        searchParams.get("initData");

      if (webAppDataStr) {
        const u = userFromInitData(webAppDataStr);
        if (u) {
          const newUser = {
            id: String(u.id),
            name: u.first_name || u.username || "Usuário",
            isTest: false,
          };
          safeLocalSet("tg_user_cache", JSON.stringify(newUser));
          resolve(newUser);
          return true;
        }
      }

      if (attempts >= maxAttempts) {
        // FIX: tenta cache antes de cair no guest — evita abrir socket com id 'guest'
        // e reabrir logo depois com o id real quando o cache é lido
        const cached = safeLocalGet("tg_user_cache");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed?.id) {
              resolve(parsed);
              return true;
            }
          } catch {}
        }
        // fallback final: guest — apenas se não houver cache nenhum
        resolve({ id: "guest", name: "Guest", isTest: true });
        return true;
      }
      return false;
    };

    if (!checkUser()) {
      const interval = setInterval(() => {
        if (checkUser()) clearInterval(interval);
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  return { user, ready, setUserManually };
}
