import React, { useEffect, useRef } from "react";

interface TelegramWidgetProps {
  postUrl: string;
}

export function TelegramWidget({ postUrl }: TelegramWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = "";

      if (!postUrl) return;

      // Limpa e extrai a identificação do post no formato "canal/id" ou "t.me/canal/id"
      let cleanPost = postUrl.trim();
      cleanPost = cleanPost.replace(/^https?:\/\/t\.me\//i, "");
      cleanPost = cleanPost.replace(/^t\.me\//i, "");

      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.setAttribute("data-telegram-post", cleanPost);
      script.setAttribute("data-width", "100%");
      script.async = true;

      containerRef.current.appendChild(script);
    }
  }, [postUrl]);

  return (
    <div
      ref={containerRef}
      className="telegram-video-container w-full min-h-[300px] flex items-center justify-center bg-black/40 rounded-2xl overflow-hidden p-2"
    />
  );
}
