import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Gamepad2, Play, Star, Trophy } from "lucide-react";
import { useTelegramUser } from "@/lib/telegram";

export const Route = createFileRoute("/games/")({
  component: GamesHub,
});

function GamesHub() {
  const { user } = useTelegramUser();
  const games = [
    {
      id: "hits-producer",
      title: "Produtor de Hits",
      description: "Domine o ritmo e transforme sua aposta em hits globais.",
      image: "https://images.unsplash.com/photo-1514525253361-bee8718a74a2?q=80&w=400&h=250&auto=format&fit=crop",
      tag: "RITMO",
      difficulty: "DIFÍCIL",
      points: "MULTIPLICADOR EC",
      route: "/games/hits-producer",
      active: true
    },
    {
      id: "studio-pet",
      title: "Studio Pet",
      description: "Cuide do mascote do estúdio e ganhe bônus diários.",
      image: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?q=80&w=400&h=250&auto=format&fit=crop",
      tag: "PET",
      difficulty: "FÁCIL",
      points: "BÔNUS DIÁRIO",
      route: "/games/studio-pet",
      active: true
    },
    {
      id: "paparazzi-escape",
      title: "Paparazzi Escape",
      description: "Fuja dos paparazzi em uma corrida alucinante pela cidade.",
      image: "https://images.unsplash.com/photo-1502602730302-390c2306d87e?q=80&w=400&h=250&auto=format&fit=crop",
      tag: "AÇÃO",
      difficulty: "MÉDIO",
      points: "REPUTAÇÃO",
      route: "/games/paparazzi-escape",
      active: true
    },
    {
      id: "queridometro",
      title: "Queridômetro",
      description: "Avalie seus rivais e aliados. Quem será o mais amado da semana?",
      image: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=400&h=250&auto=format&fit=crop",
      tag: "SOCIAL",
      difficulty: "FÁCIL",
      points: "REPUTAÇÃO",
      route: "/games/queridometro",
      active: true
    }
  ];

  return (
    <main className="flex-1 mx-auto w-full max-w-2xl px-4 pt-6 pb-32 bg-[#F5F5F5] min-h-screen">
      <Link to="/" className="inline-flex items-center gap-1 text-black mb-6 font-black uppercase text-[10px] hover:text-primary transition-colors">
        <ChevronLeft className="size-4" /> Painel Geral
      </Link>

      <header className="mb-10">
        <div className="size-16 rounded-[24px] bg-primary text-black grid place-items-center mb-6 shadow-[6px_6px_0px_#000] border-4 border-black">
          <Gamepad2 className="size-8" />
        </div>
        <h1 className="text-5xl font-black italic uppercase tracking-tighter text-black leading-none">
          Empire <span className="text-primary drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">Games</span>
        </h1>
        <p className="text-black font-black mt-3 uppercase text-[10px] tracking-widest opacity-40">Setor de Entretenimento Bancário</p>
      </header>

      {/* ID Status Badge */}
      <div className="mb-10">
        <div
          className={`inline-flex px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase border-4 border-black shadow-[6px_6px_0px_#000] items-center gap-3 ${user?.id === "guest" ? "bg-red-500 text-white" : "bg-white text-black"}`}
        >
          <div className="size-2.5 rounded-full bg-current animate-pulse" />
          Terminal Ativo: {user?.id}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {games.map((game) => (
          <Link
            key={game.id}
            to={game.route as any}
            className={`group relative bg-white border-4 border-black p-6 rounded-[48px] transition-all flex flex-col sm:flex-row gap-8 overflow-hidden items-center ${
              game.active 
                ? "hover:-translate-y-1 hover:shadow-[16px_16px_0px_#000] active:translate-y-0.5 active:shadow-none shadow-[12px_12px_0px_#000]" 
                : "opacity-60 cursor-not-allowed shadow-[8px_8px_0px_#000]"
            }`}
          >
            <div className="size-40 sm:size-44 rounded-[32px] overflow-hidden border-4 border-black flex-shrink-0 relative">
              <img
                src={game.image}
                alt={game.title}
                className={`w-full h-full object-cover transition-transform ${game.active ? "group-hover:scale-110" : ""}`}
              />
              <div className="absolute top-4 right-4 bg-primary text-black text-[10px] font-black px-4 py-1.5 rounded-full border-2 border-black uppercase tracking-tighter shadow-[3px_3px_0px_#000]">
                {game.tag}
              </div>
              {!game.active && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Play className="size-12 text-white/40" />
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col justify-center min-w-0 text-center sm:text-left">
              <div className="flex flex-col mb-2">
                <h2 className="text-3xl sm:text-4xl font-black italic uppercase leading-[0.85] text-black mb-3">
                  {game.title}
                </h2>
                <p className="text-[11px] font-bold text-black/50 leading-tight uppercase tracking-tight max-w-[280px]">
                  {game.description}
                </p>
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-8 mt-5">
                <div className="flex items-center gap-2.5 text-[12px] font-black uppercase text-black italic">
                  <Star className="size-4 text-primary fill-primary" />
                  {game.difficulty}
                </div>
                <div className="flex items-center gap-2.5 text-[12px] font-black uppercase text-black italic">
                  <Trophy className="size-4 text-primary" />
                  {game.points}
                </div>
              </div>

              <div className={`mt-8 py-4 rounded-[20px] font-black uppercase italic tracking-[0.2em] text-xs flex items-center justify-center gap-4 border-2 transition-all ${
                game.active 
                  ? "bg-black text-primary border-primary group-hover:bg-primary group-hover:text-black group-hover:border-black shadow-[6px_6px_0px_rgba(0,0,0,0.1)] group-hover:shadow-none" 
                  : "bg-zinc-200 text-zinc-400 border-zinc-300"
              }`}>
                {game.active ? (
                  <>
                    <Play className="size-5 fill-current" />
                    Iniciar Sessão
                  </>
                ) : (
                  <>Brevemente</>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <section className="mt-16 p-10 rounded-[48px] bg-primary border-4 border-black shadow-[16px_16px_0px_#000] text-center relative overflow-hidden">
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <h3 className="font-black text-black uppercase text-2xl tracking-tighter mb-3 italic leading-none relative z-10">
          ALERTA DE SISTEMA
        </h3>
        <p className="text-[11px] font-black text-black/60 uppercase leading-relaxed max-w-[300px] mx-auto relative z-10">
          Novos algoritmos de entretenimento estão sendo carregados. Fique atento para atualizações.
        </p>
      </section>
    </main>
  );
}
