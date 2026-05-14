import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, Library } from "lucide-react";
import { useTelegramUser } from "@/lib/telegram";
import { api, fmtEC, driveImg, type Artist } from "@/lib/api";

export const Route = createFileRoute("/artistas/")({
  component: ArtistasList,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      filter: (search.filter as string) || "mine",
    };
  },
});

function ArtistasList() {
  const { user, ready } = useTelegramUser();
  const { filter } = Route.useSearch();
  const [artists, setArtists] = useState<Artist[] | null>(null);

  useEffect(() => {
    if (!ready) return;

    if (filter === "all") {
      api.listarTodos().then(setArtists);
    } else {
      if (!user || user.id === "guest") {
        setArtists([]);
        return;
      }
      api.meusArtistas(user.id).then(setArtists);
    }
  }, [ready, user, filter]);

  return (
    <main className="flex-1 mx-auto w-full max-w-2xl px-4 pt-6">
      <header className="mb-4">
        <p className="text-[8px] uppercase tracking-[0.2em] text-primary/70 font-black mb-1">
          {filter === "all" ? "A Indústria" : "Seu Plantel"}
        </p>
        <h1 className="text-xl font-black tracking-tighter uppercase italic">
          {filter === "all" ? "Empire Artists" : "Meus Artistas"}
        </h1>
      </header>
      {!user && ready && (
        <p className="text-sm text-muted-foreground">O acesso exige identificação imperial via Telegram.</p>
      )}
      {artists === null ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-card animate-pulse border border-white/5" />
          ))}
        </div>
      ) : artists.length === 0 ? (
        <div className="space-y-6 flex flex-col items-center justify-center py-16 text-center">
          <div className="size-20 rounded-full bg-white/5 grid place-items-center mb-2">
            <Library className="size-10 text-muted-foreground/20" />
          </div>
          <div>
            <p className="text-sm font-bold text-muted-foreground italic">
              {filter === "all" ? "Nenhuma lenda registrada no império." : "Nenhuma lenda sob seu comando ainda."}
            </p>
            {filter !== "all" && (
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">Conecte seu ID do Telegram para gerenciar artistas vinculados.</p>
            )}
          </div>
          
          {filter !== "all" && (
            <div className="w-full max-w-xs space-y-3 pt-4">
               <button 
                onClick={() => (window as any).setShowLinkModal?.(true)}
                className="w-full py-5 rounded-[2rem] bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(var(--primary-rgb),0.3)] active:scale-95 transition-all text-xs"
              >
                Vincular meu Artista
              </button>
              <button 
                onClick={() => (window as any).setShowIdModal?.(true)}
                className="w-full py-5 rounded-[2rem] bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest active:scale-95 transition-all text-[10px]"
              >
                Inserir ID Manualmente
              </button>
            </div>
          )}
        </div>
      ) : (
        <ul className="space-y-4">
          {[...artists]
            .sort((a, b) => a.nome.localeCompare(b.nome))
            .map((a) => {
              const isAllFilter = filter === "all";
              const showDescription =
                a.descricao &&
                a.descricao !== "" &&
                a.descricao !== "Ainda não há nada por aqui sobre esse artista.";

              if (isAllFilter) {
                const generoVal = a.genero && a.genero.trim() !== "" ? a.genero : null;
                const paisVal = a.pais && a.pais.trim() !== "" ? a.pais : null;
                
                // Limpa descrições curtas ou placeholders como "sim", "não", etc.
                const cleanDescription = (a.descricao || "").trim();
                const hasDescription = 
                  cleanDescription.length > 3 && 
                  !["sim", "não", "vazio", "n/a"].includes(cleanDescription.toLowerCase());

                return (
                  <li key={a.nome}>
                    <div className="p-4 rounded-[28px] bg-card/50 border border-white/5 shadow-2xl relative overflow-hidden group backdrop-blur-sm">
                      <div className="absolute top-0 right-0 size-40 bg-primary/5 blur-[50px] -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
                      
                      <div className="flex gap-4 relative z-10">
                        <div className="size-20 shrink-0 rounded-2xl overflow-hidden border-2 border-white/10 bg-slate-900 shadow-xl self-start">
                          <img
                            src={driveImg(a.foto)}
                            alt={a.nome}
                            loading="lazy"
                            className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-110"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1514525253361-bee8718a300c?w=400&h=400&fit=crop";
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col pt-1">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            {generoVal && (
                              <span className="text-[8px] font-black uppercase tracking-widest bg-primary/20 text-primary px-2 py-0.5 rounded border border-primary/30 shadow-sm">
                                {generoVal}
                              </span>
                            )}
                            {paisVal && (
                              <span className="text-[8px] font-bold text-white/90 uppercase tracking-tight bg-white/10 px-2 py-0.5 rounded border border-white/10 shadow-sm backdrop-blur-md flex items-center gap-1">
                                <span className="opacity-50">📍</span> {paisVal}
                              </span>
                            )}
                          </div>
                          
                          <h3 className="text-base font-black italic uppercase tracking-tighter leading-tight text-white mb-1 group-hover:text-primary transition-colors truncate">
                            {a.nome}
                          </h3>

                          <div className="flex items-center gap-4 mb-2">
                             <div className="flex flex-col min-w-0">
                               <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Fortuna</span>
                               <span className="text-xs font-black text-emerald-400 truncate">{fmtEC(a.fortuna_total)}</span>
                             </div>
                             <div className="w-[1px] h-6 bg-white/10" />
                             <div className="flex flex-col min-w-0">
                               <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Prestígio</span>
                               <span className="text-xs font-black text-amber-400 truncate">{a.prestigio.toLocaleString('pt-BR')} pts</span>
                             </div>
                          </div>

                          {hasDescription && (
                            <p className="text-xs text-muted-foreground/90 leading-relaxed italic line-clamp-2 border-t border-white/10 pt-2">
                              {a.descricao}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              }

              return (
                <li key={a.nome}>
                  <Link
                    to="/artistas/$nome/"
                    params={{ nome: a.nome }}
                    className="flex items-center gap-4 p-3 pr-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all hover:scale-[1.02] active:scale-[0.98] group"
                  >
                    <div className="size-16 rounded-xl overflow-hidden bg-secondary border border-white/10 shadow-lg">
                      <img
                        src={driveImg(a.foto)}
                        alt={a.nome}
                        loading="lazy"
                        className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm tracking-tight truncate">{a.nome}</p>
                      <p className="text-[8px] font-black text-primary uppercase tracking-widest truncate">
                        {fmtEC(a.saldo)} <span className="text-muted-foreground/40 mx-1">•</span> {a.gravadora}
                      </p>
                    </div>
                    <ChevronRight className="size-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                  </Link>
                </li>
              );
            })}
        </ul>
      )}
    </main>
  );
}
