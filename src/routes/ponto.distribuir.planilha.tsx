import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Loader2 } from "lucide-react";
import { PlanilhaGrid } from "@/components/PlanilhaGrid";
import { api } from "@/lib/api";
import { useTelegramUser } from "@/lib/telegram";

export const Route = createFileRoute("/ponto/distribuir/planilha")({
  component: PontoPlanilha,
});

const OPCOES_PONTOS: Record<string, string[]> = {
  "BILLBOARD HOT 100": ["1,00%", "2,00%", "3,00%", "4,00%", "5,00%", "6,00%", "7,00%", "8,00%", "9,00%", "10,00%"],
  SPOTIFY: ["30,00%", "40,00%", "50,00%", "60,00%", "70,00%"],
  "APPLE MUSIC": ["30,00%", "40,00%", "50,00%", "60,00%", "70,00%"],
  YOUTUBE: [
    "10,00%",
    "15,00%",
    "20,00%",
    "25,00%",
    "30,00%",
    "35,00%",
    "40,00%",
    "45,00%",
    "50,00%",
    "55,00%",
    "60,00%",
    "65,00%",
    "70,00%",
  ],
  "DIGITAL SALES": [
    "10,00%",
    "15,00%",
    "20,00%",
    "25,00%",
    "30,00%",
    "35,00%",
    "40,00%",
    "45,00%",
    "50,00%",
    "55,00%",
    "60,00%",
    "65,00%",
    "70,00%",
  ],
  "BILLBOARD 200": [
    "10,00%",
    "15,00%",
    "20,00%",
    "25,00%",
    "30,00%",
    "35,00%",
    "40,00%",
    "45,00%",
    "50,00%",
    "55,00%",
    "60,00%",
    "65,00%",
    "70,00%",
  ],
};

function PontoPlanilha() {
  const { user, ready } = useTelegramUser();

  if (!ready)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );

  if (!user?.id)
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        Abra o app pelo Telegram para acessar esta tela.
      </div>
    );

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <Link to="/ponto/distribuir" className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="w-4 h-4" /> Voltar
      </Link>
      <div>
        <h2 className="text-xl font-black italic tracking-tighter">Pontos · Manual</h2>
        <p className="text-xs text-muted-foreground mt-1">Toque em uma música para distribuir os pontos.</p>
      </div>
      <PlanilhaGrid
        tgId={String(user.id)}
        loader={(tgId) => api.listarPontosJogador(tgId)}
        saver={(p) => api.salvarCelulaPontos(p)}
        opcoesColunas={OPCOES_PONTOS}
      />
    </div>
  );
}
