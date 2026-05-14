import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { 
  ChevronLeft, 
  Timer, 
  Info, 
  User, 
  History,
  Coins,
  CheckCircle2,
  Star
} from "lucide-react";
import { useTelegramUser } from "../lib/telegram";
import { api, driveImg } from "../lib/api";
import { ArtistLoginOverlay } from "../components/games/ArtistLoginOverlay";

export const Route = createFileRoute("/games/queridometro")({
  component: QueridometroGame,
});

// -- CONFIGURAÇÕES --

interface Participant {
  nome: string;
  avatar?: string;
  foto?: string;
  saldo: number;
}

interface Reaction {
  de: string;
  emoji: string;
  pts: number;
  data: string;
}

function QueridometroGame() {
  const { user } = useTelegramUser();
  const [activeTab, setActiveTab] = useState<"VOTAR" | "RANKING" | "PERFIL">("VOTAR");
  const [selectedTarget, setSelectedTarget] = useState<Participant | null>(null);
  const [artistasAlvos, setArtistasAlvos] = useState<Participant[]>([]);
  const [meusArtistas, setMeusArtistas] = useState<Participant[]>([]);
  const [activeArtist, setActiveArtist] = useState<Participant | null>(null);
  const [reacoesRecebidas, setReacoesRecebidas] = useState<Reaction[]>([]);
  const [configEmojis, setConfigEmojis] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [semana, setSemana] = useState("");

  const fetchData = async () => {
    const tgId = user?.id || "";
    if (tgId === "guest") {
      setLoading(false);
      return;
    }
    try {
      const res = await api.getQueridometroStatus(tgId);
      if (res.ok) {
        setArtistasAlvos(res.artistasAlvos || []);
        setMeusArtistas(res.meusArtistas || []);
        setConfigEmojis(res.configEmojis || []);
        setRanking(res.ranking || []);
        setSemana(res.semana || "");
        
        // Auto-select first artist if not set
        if (!activeArtist && res.meusArtistas && res.meusArtistas.length > 0) {
          setActiveArtist(res.meusArtistas[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const handleSendReaction = async (emoji: string) => {
    if (!selectedTarget || !activeArtist || submitting) return;
    
    setSubmitting(true);
    const tgId = user?.id || "";
    
    try {
      const res = await api.postQueridometroVoto(tgId, activeArtist.nome, selectedTarget.nome, emoji);
      if (res.ok) {
        setSelectedTarget(null);
        await fetchData(); // Refresh data
      } else {
        alert(res.erro || "Erro ao votar");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center">
         <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
         <p className="text-primary font-cabinet font-black uppercase tracking-[0.4em] text-xs">Sincronizando Queridômetro...</p>
      </div>
    );
  }

  if (meusArtistas.length === 0) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center p-8 text-center min-h-screen">
         <User className="size-20 text-white/10 mb-8" />
         <h2 className="text-2xl font-cabinet font-black text-white uppercase italic mb-4">Artista Não Encontrado</h2>
         <p className="text-white/40 text-sm mb-10">Você precisa ter ao menos um artista vinculado no Empire Hub para participar.</p>
         <Link to="/studio" className="bg-white text-black px-10 py-4 rounded-full font-black uppercase italic tracking-widest">Ir para o Studio</Link>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-black min-h-screen relative overflow-hidden font-satoshi flex flex-col">
      {!activeArtist && (
        <ArtistLoginOverlay 
          gameName="Queridômetro" 
          onSelect={(a) => {
            setActiveArtist(a);
            fetchData();
          }} 
        />
      )}
      {/* HEADER FIXED */}
      <header className="p-6 bg-black/80 backdrop-blur-3xl border-b border-white/10 z-30 sticky top-0">
        <div className="flex items-center justify-between mb-4">
           <div className="flex items-center gap-4">
              <Link to="/games" className="size-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white">
                <ChevronLeft className="size-5" />
              </Link>
              <div>
                <h1 className="text-xl font-cabinet font-black italic uppercase tracking-tighter text-white">Queridômetro</h1>
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{semana}</p>
              </div>
           </div>
           <div className="text-right">
              <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center justify-end gap-1 mb-1">
                 <Timer className="size-3" /> Termina em
              </div>
              <div className="text-lg font-cabinet font-black text-white italic leading-none">Dom. 23:59</div>
           </div>
        </div>

        {/* ARTIST SELECTOR (LOGIN) */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
           {meusArtistas.map(art => (
             <button 
              key={art.nome}
              onClick={() => setActiveArtist(art)}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${activeArtist?.nome === art.nome ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-white/40'}`}
             >
                <div className="size-6 rounded-full overflow-hidden bg-white/10">
                   <img src={driveImg(art.foto, 100)} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                </div>
                <span className="text-[10px] font-black uppercase">{art.nome}</span>
                {activeArtist?.nome === art.nome && <CheckCircle2 className="size-3" />}
             </button>
           ))}
        </div>
      </header>

      {/* TABS SELECTOR */}
      <div className="px-6 py-4 flex gap-2">
         {[
           { id: "VOTAR", label: "⭐ Votar" },
           { id: "RANKING", label: "🏆 Ranking" },
           { id: "PERFIL", label: "👤 Eu" }
         ].map(tab => (
           <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3 rounded-2xl font-black uppercase italic text-[11px] tracking-widest transition-all ${activeTab === tab.id ? 'bg-primary text-black border-2 border-black shadow-[4px_4px_0_#000]' : 'bg-white/5 border border-white/10 text-white/40'}`}
           >
              {tab.label}
           </button>
         ))}
      </div>

      {/* CONTENT AREA */}
      <main className="flex-1 px-6 pb-24 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === "VOTAR" && (
            <motion.div key="votar" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
               <div className="bg-primary/20 border border-primary/30 p-4 rounded-3xl mb-8 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">Voto Estratégico</span>
                     <div className="bg-primary text-black px-3 py-1 rounded-full font-cabinet font-black italic text-[11px] uppercase">
                        {activeArtist?.nome}
                     </div>
                  </div>
                  <div className="text-right">
                     <div className="flex items-center gap-2 text-white justify-end">
                        <Info className="size-3" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Gaste EC para dar Prestígio</span>
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  {artistasAlvos.filter(a => a.nome !== activeArtist?.nome).map(p => (
                    <button 
                      key={p.nome}
                      onClick={() => setSelectedTarget(p)}
                      className="bg-white/5 border border-white/10 p-4 rounded-[32px] group active:scale-95 transition-all flex flex-col items-center aspect-[4/5] justify-center"
                    >
                      <div className="size-20 rounded-full border-2 border-white/10 p-1 mb-4 relative overflow-hidden bg-white/5">
                        <img 
                          src={driveImg(p.foto) || "https://images.unsplash.com/photo-1514525253361-bee8718a74a2?q=80&w=150&h=150&auto=format&fit=crop"} 
                          className="w-full h-full object-cover rounded-full" 
                          alt={p.nome} 
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <h3 className="text-xs font-cabinet font-black text-white italic uppercase tracking-tight mb-2 text-center line-clamp-1">{p.nome}</h3>
                    </button>
                  ))}
               </div>
            </motion.div>
          )}

          {activeTab === "RANKING" && (
            <motion.div key="ranking" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
               {ranking.map((p, i) => (
                 <div key={p.nome} className={`flex items-center gap-4 bg-white/5 p-4 rounded-[28px] border ${meusArtistas.some(m => m.nome === p.nome) ? 'border-primary' : 'border-white/10'}`}>
                    <div className="size-10 flex items-center justify-center font-cabinet font-black italic text-2xl text-white/20">
                       {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`}
                    </div>
                    <div className="size-12 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex-shrink-0">
                       <img src={driveImg(p.img || p.foto)} className="w-full h-full object-cover" alt={p.nome} referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1 min-w-0">
                       <h4 className="text-sm font-cabinet font-black text-white italic uppercase truncate">{p.nome}</h4>
                       
                       {/* Emojis Recebidos Anonimamente */}
                       <div className="flex flex-wrap gap-1 mt-1.5 min-h-[1.5rem]">
                          {p.emojisRecebidos && p.emojisRecebidos.length > 0 ? (
                            p.emojisRecebidos.slice(0, 8).map((emo: string, idx: number) => (
                              <span key={idx} className="text-sm grayscale-[0.2] hover:grayscale-0 transition-all">{emo}</span>
                            ))
                          ) : (
                            <span className="text-[10px] text-white/10 font-black uppercase tracking-widest italic">Nenhum voto</span>
                          )}
                          {p.emojisRecebidos && p.emojisRecebidos.length > 8 && (
                            <span className="text-[10px] text-white/40 font-black">+{p.emojisRecebidos.length - 8}</span>
                          )}
                       </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                       <div className="text-xl font-cabinet font-black text-gold italic leading-none">{p.totalVotos || 0}</div>
                       <span className="text-[9px] font-black text-white/30 uppercase italic text-right block">Votos</span>
                    </div>
                 </div>
               ))}
            </motion.div>
          )}

          {activeTab === "PERFIL" && activeArtist && (
            <motion.div key="perfil" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
               <div className="flex flex-col items-center text-center mb-10">
                  <div className="size-32 rounded-full border-4 border-primary p-1.5 mb-6 shadow-[0_0_40px_rgba(200,75,255,0.2)] bg-white/5">
                    <img src={driveImg(activeArtist.foto)} className="w-full h-full object-cover rounded-full" alt="Me" referrerPolicy="no-referrer" />
                  </div>
                  <h2 className="text-3xl font-cabinet font-black italic text-white uppercase tracking-tighter mb-2">{activeArtist.nome}</h2>
                  <div className="flex items-center gap-2 mb-6">
                     <div className="px-4 py-1.5 bg-primary/20 border border-primary/40 rounded-full text-[10px] font-black text-primary uppercase tracking-widest">
                        NÍVEL DE PRESTÍGIO: {Math.floor(activeArtist.prestigio)}
                     </div>
                  </div>
                  <div className="text-5xl font-cabinet font-black text-gold italic">{Math.floor(activeArtist.saldo).toLocaleString()} EC</div>
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest mt-2">Saldo em Empire Coins</span>
               </div>

               <div className="p-8 bg-white/5 border border-white/10 rounded-[40px] text-center space-y-4">
                  <div className="size-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                     <Star className="size-6 text-primary" />
                  </div>
                  <h4 className="text-white font-cabinet font-black italic uppercase">Poder de Influência</h4>
                  <p className="text-white/40 text-[11px] font-black uppercase tracking-widest leading-relaxed px-4">
                     O Prestígio acumulado no Queridômetro aumenta as chances de suas músicas viralizarem organicamente no Hub futuramente.
                  </p>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* REACTION MODAL OVERLAY */}
      <AnimatePresence>
        {selectedTarget && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8"
          >
             <button onClick={() => setSelectedTarget(null)} className="absolute top-10 right-10 text-white/20 hover:text-white uppercase font-black text-xs tracking-widest">FECHAR</button>

             <div className="size-28 rounded-[40px] border-4 border-primary p-2 mb-8 rotate-3 shadow-[0_0_60px_rgba(200,75,255,0.3)] bg-white/5">
                <img src={driveImg(selectedTarget.foto) || "https://images.unsplash.com/photo-1514525253361-bee8718a74a2?q=80&w=150&h=150&auto=format&fit=crop"} className="w-full h-full object-cover rounded-[28px]" alt="Target" referrerPolicy="no-referrer" />
             </div>

             <h2 className="text-4xl font-cabinet font-black italic text-white uppercase text-center mb-2 tracking-tighter">O QUE VOCÊ<br/>ACHOU DE <span className="text-primary">{selectedTarget.nome}</span>?</h2>
             <p className="text-white/40 text-[11px] font-black uppercase tracking-widest mb-12">Como {activeArtist?.nome}</p>

             {submitting ? (
               <div className="flex flex-col items-center">
                  <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-primary uppercase font-black italic text-xs">Enviando voto...</p>
               </div>
             ) : (
               <div className="grid grid-cols-3 gap-6 w-full max-w-md">
                  {configEmojis.map(e => (
                    <button 
                      key={e.emoji}
                      onClick={() => handleSendReaction(e.emoji)}
                      className="aspect-square bg-white/5 border border-white/10 rounded-[32px] flex flex-col items-center justify-center gap-2 transition-all hover:bg-primary hover:border-black active:scale-90 group p-2 text-center"
                    >
                       <span className="text-4xl transition-transform group-hover:scale-125">{e.emoji}</span>
                       <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-black group-hover:text-black text-primary uppercase tracking-widest">-{e.custo} EC</span>
                          <span className="text-[7px] font-black group-hover:text-black/60 text-white/40 uppercase">Custo de Envio</span>
                       </div>
                    </button>
                  ))}
               </div>
             )}

             <div className="mt-16 flex items-center gap-3 opacity-30">
                <Info className="size-4" />
                <p className="text-[9px] font-black uppercase tracking-widest text-center px-8">O prestígio gerado para {selectedTarget.nome} é confidencial e muda semanalmente.</p>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default QueridometroGame;
