import { useEffect, useState } from "react";

// Tipos mínimos pro Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        setHeaderColor?: (c: string) => void;
        setBackgroundColor?: (c: string) => void;
        initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string } };
      };
    };
  }
}

export interface TgUser {
  id: string;
  name?: string;
  username?: string;
  photo_url?: string;
  isTest: boolean;
}

export function useTelegramUser(): { 
  user: TgUser | null; 
  ready: boolean;
  setUserManually: (id: string, name?: string) => void;
} {
  const [user, setUser] = useState<TgUser | null>(null);
  const [ready, setReady] = useState(false);

  const setUserManually = (id: string, name?: string) => {
    const newUser = {
      id,
      name: name || "Usuário Manual",
      isTest: true,
    };
    setUser(newUser);
    localStorage.setItem("tg_user_cache", JSON.stringify(newUser));
    setReady(true);
  };

  // Função auxiliar para tentar pegar usuario de uma string de initData
  const userFromInitData = (str: string) => {
    try {
      const p = new URLSearchParams(str);
      const u = p.get("user");
      if (u) return JSON.parse(u);
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1) Procure por IDs comuns na URL (id, tg_id, user_id, uid, telegram_id)
    const params = new URLSearchParams(window.location.search);
    console.log("DEBUG URL Params:", window.location.search);

    const urlId =
      params.get("id") ||
      params.get("tg_id") ||
      params.get("user_id") ||
      params.get("uid") ||
      params.get("telegram_id") ||
      params.get("tgid") ||
      params.get("tgid");

    const nameFromUrl =
      params.get("name") ||
      params.get("username") ||
      params.get("first_name") ||
      params.get("user_name");

    if (urlId) {
      console.log("Usuário detectado via URL:", urlId);
      const newUser = {
        id: urlId,
        name: nameFromUrl || "Usuário #" + urlId.slice(-4),
        isTest: true,
      };
      setUser(newUser);
      localStorage.setItem("tg_user_cache", JSON.stringify(newUser));
      setReady(true);
      return;
    }

    // Tentar detectar usuario com polling para garantir que o SDK carregou
    let attempts = 0;
    const maxAttempts = 20; // 2 segundos (100ms cada)
    
    const checkUser = () => {
      attempts++;
      const tg = window.Telegram?.WebApp;
      let sdkUser = tg?.initDataUnsafe?.user;
      
      if (sdkUser) {
        console.log("Usuário detectado pelo SDK:", sdkUser.id);
        const newUser: TgUser = {
          id: String(sdkUser.id),
          name: sdkUser.first_name || sdkUser.username || "Usuário",
          username: sdkUser.username,
          photo_url: (sdkUser as any).photo_url,
          isTest: false,
        };
        setUser(newUser);
        localStorage.setItem("tg_user_cache", JSON.stringify(newUser));
        if (tg) {
          tg.ready();
          tg.expand();
        }
        setReady(true);
        return true;
      }
      
      // Se chegamos aqui e temos initData bruto na URL/Hash, tentamos ele
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
          console.log("Usuário detectado via initData manual:", u.id);
          const newUser = {
            id: String(u.id),
            name: u.first_name || u.username || "Usuário",
            isTest: false,
          };
          setUser(newUser);
          localStorage.setItem("tg_user_cache", JSON.stringify(newUser));
          setReady(true);
          return true;
        }
      }

      if (attempts >= maxAttempts) {
        // Tentar cache como última esperança antes do guest
        const cached = localStorage.getItem("tg_user_cache");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setUser(parsed);
            setReady(true);
            return true;
          } catch(e) {}
        }
        
        console.warn("Tempo de detecção esgotado. Usando Guest.");
        setUser({ id: "guest", name: "Guest", isTest: true });
        setReady(true);
        return true;
      }
      
      return false;
    };

    // Primeira tentativa imediata
    if (!checkUser()) {
      const interval = setInterval(() => {
        if (checkUser()) {
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  return { user, ready, setUserManually };
}
