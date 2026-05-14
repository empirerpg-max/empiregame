import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { 
  ChevronLeft, 
  Coins, 
  Info, 
  Moon, 
  Sun, 
  Utensils, 
  Gamepad2 as Gamepad,
  History,
  Sparkles,
  Timer
} from "lucide-react";
import { useTelegramUser } from "../lib/telegram";
import { api } from "../lib/api";
import { ArtistLoginOverlay } from "../components/games/ArtistLoginOverlay";

export const Route = createFileRoute("/games/studio-pet")({
  component: StudioPetGame,
});

// -- CONFIGURAÇÕES --
const DECAY_HUNGER = 6; // por hora
const DECAY_ENERGY = 4; // por hora
const DECAY_MOOD = 5;   // por hora
const DECAY_CLEAN = 3;  // por hora

const FEED_COST = 30;
const FEED_HUNGER = 35;
const PLAY_COST = 20;
const PLAY_MOOD = 40;
const CLEAN_COST = 10;
const CLEAN_VAL = 50;
const SLEEP_DURATION = 2 * 60 * 60 * 1000; // 2 horas

interface PetState {
  hunger: number;
  energy: number;
  mood: number;
  clean: number;
  lastSaved: number;
  isSleeping: boolean;
  sleepEnd: number | null;
}

interface LogEntry {
  icon: string;
  msg: string;
  time: string;
}

function StudioPetGame() {
  const { user } = useTelegramUser();
  const [activeArtist, setActiveArtist] = useState<any>(null);
  const [pet, setPet] = useState<PetState>({
    hunger: 70,
    energy: 60,
    mood: 75,
    clean: 100,
    lastSaved: Date.now(),
    isSleeping: false,
    sleepEnd: null,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showLoot, setShowLoot] = useState<{ amount: number } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "bad" | "info" } | null>(null);
  const [popText, setPopText] = useState<{ x: number, y: number, text: string } | null>(null);

  const statsInterval = useRef<any>(null);

  const addLog = (icon: string, msg: string) => {
    const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    setLogs(prev => [{ icon, msg, time }, ...prev].slice(0, 20));
  };

  const showToast = (msg: string, type: "ok" | "bad" | "info" = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const triggerPopText = (text: string) => {
    setPopText({ x: Math.random() * 100 - 50, y: -50, text });
    setTimeout(() => setPopText(null), 1000);
  };

  const syncState = async (newState: PetState) => {
    if (!user?.id || user.id === "guest") return;
    setIsSyncing(true);
    try {
      await api.savePetState(user.id, JSON.stringify(newState));
    } catch (e) {
      console.error("Erro ao salvar pet:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadData = async () => {
    const tgId = user?.id || "";
    if (tgId === "guest") {
      setLoading(false);
      return;
    }
    try {
      const res = await api.getPetState(tgId);
      if (res.ok && res.payload) {
        const saved = JSON.parse(res.payload) as PetState;
        
        // Aplicar decaimento offline
        const now = Date.now();
        const minutesOffline = (now - (saved.lastSaved || now)) / 60000;
        const hoursOffline = minutesOffline / 60;

        let { hunger, energy, mood, clean, isSleeping, sleepEnd } = saved;

        // Se clean não existir no salvo (versão antiga), inicializa
        if (clean === undefined) clean = 100;

        if (isSleeping && sleepEnd && now >= sleepEnd) {
          isSleeping = false;
          sleepEnd = null;
          energy = 100;
          addLog("☀️", "O pet acordou cheio de energia enquanto você estava fora!");
        } else if (!isSleeping) {
          energy = Math.max(0, energy - DECAY_ENERGY * hoursOffline);
        }

        hunger = Math.max(0, hunger - DECAY_HUNGER * hoursOffline);
        mood = Math.max(0, mood - DECAY_MOOD * hoursOffline);
        clean = Math.max(0, clean - DECAY_CLEAN * hoursOffline);

        const newState = { ...saved, hunger, energy, mood, clean, isSleeping, sleepEnd, lastSaved: now };
        setPet(newState);
        
        if (minutesOffline > 15) {
          addLog("⏰", `Você ficou ${Math.floor(minutesOffline)}min fora. Os atributos decaíram.`);
        }

        // Chance de Loot se feliz
        if (hunger > 60 && energy > 60 && mood > 60 && clean > 60 && Math.random() < 0.3) {
          const loot = Math.floor(Math.random() * 100) + 20;
          setShowLoot({ amount: loot });
          await api.syncGameCoins(tgId, 0, loot, "Pet Studio (Bônus Offline)", activeArtist?.nome);
          addLog("💰", `Seu pet estava bem cuidado e gerou ${loot} EC!`);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) loadData();
    
    statsInterval.current = setInterval(() => {
      setPet(prev => {
        if (prev.isSleeping) return prev;
        return {
          ...prev,
          hunger: Math.max(0, prev.hunger - DECAY_HUNGER / 360),
          energy: Math.max(0, prev.energy - DECAY_ENERGY / 360),
          mood: Math.max(0, prev.mood - DECAY_MOOD / 360),
          clean: Math.max(0, prev.clean - DECAY_CLEAN / 360),
        };
      });
    }, 10000);

    return () => clearInterval(statsInterval.current);
  }, [user?.id]);

  const handleAction = async (type: "FEED" | "PLAY" | "SLEEP" | "CLEAN") => {
    if (!activeArtist || (pet.isSleeping && type !== "SLEEP")) return;

    let newState = { ...pet };
    const tgId = user?.id || "";

    if (type === "FEED") {
      if (activeArtist.saldo < FEED_COST) {
        showToast("Saldo insuficiente!", "bad");
        return;
      }
      newState.hunger = Math.min(100, newState.hunger + FEED_HUNGER);
      newState.clean = Math.max(0, newState.clean - 5); // Suja um pouco
      addLog("🍖", "Você deu um lanche especial. Nhac!");
      triggerPopText("+Alvura");
      showToast("Mhummm! Delícia! 🍔", "ok");
      await api.syncGameCoins(tgId, FEED_COST, 0, "Pet Studio (Alimentar)", activeArtist.nome);
    } 
    else if (type === "PLAY") {
      if (activeArtist.saldo < PLAY_COST) {
        showToast("Saldo insuficiente!", "bad");
        return;
      }
      if (newState.energy < 15) {
        showToast("Cansado demais para brincar...", "info");
        return;
      }
      newState.mood = Math.min(100, newState.mood + PLAY_MOOD);
      newState.energy = Math.max(0, newState.energy - 10);
      newState.clean = Math.max(0, newState.clean - 10);
      addLog("🎮", "Sessão de jogos! O pet adorou.");
      triggerPopText("+Diversão");
      showToast("Isso foi épico! 🕹️", "ok");
      await api.syncGameCoins(tgId, PLAY_COST, 0, "Pet Studio (Brincar)", activeArtist.nome);
    }
    else if (type === "CLEAN") {
      if (activeArtist.saldo < CLEAN_COST) {
        showToast("Saldo insuficiente!", "bad");
        return;
      }
      newState.clean = Math.min(100, newState.clean + CLEAN_VAL);
      addLog("🛁", "Banho completo no estúdio!");
      triggerPopText("Brilhando!");
      showToast("Estou limpinho! ✨", "ok");
      await api.syncGameCoins(tgId, CLEAN_COST, 0, "Pet Studio (Limpar)", activeArtist.nome);
    }
    else if (type === "SLEEP") {
      if (pet.isSleeping) return;
      newState.isSleeping = true;
      newState.sleepEnd = Date.now() + SLEEP_DURATION;
      addLog("😴", "Câmera apagada. O mascote foi descansar.");
      showToast("Hora de recarregar... 🌙", "info");
    }

    newState.lastSaved = Date.now();
    setPet(newState);
    syncState(newState);
  };

  const getPetImage = () => {
    const avg = (pet.hunger + pet.energy + pet.mood + pet.clean) / 4;
    // Imagens reais de mascotinhos 3D (Placeholders de alta qualidade)
    if (pet.isSleeping) return "https://images.unsplash.com/photo-1590691566700-11509b78aee1?q=80&w=400&h=400&auto=format&fit=crop";
    if (avg < 30) return "https://images.unsplash.com/photo-1517849845537-4d257902454a?q=80&w=400&h=400&auto=format&fit=crop"; // Triste/Sujeira
    return "https://images.unsplash.com/photo-1614583225154-5fcdda07019e?q=80&w=400&h=400&auto=format&fit=crop"; // Normal/Feliz
  };

  // Tempo restante de sono
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!pet.isSleeping || !pet.sleepEnd) return;
    const timer = setInterval(() => {
      const diff = pet.sleepEnd! - Date.now();
      if (diff <= 0) {
        setPet(prev => ({ ...prev, isSleeping: false, sleepEnd: null, energy: 100 }));
        clearInterval(timer);
      } else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [pet.isSleeping, pet.sleepEnd]);

  if (loading) {
    return (
      <div className="flex-1 bg-[#080812] flex flex-col items-center justify-center">
         <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_20px_rgba(200,75,255,0.4)]" />
         <p className="text-primary font-cabinet font-black uppercase tracking-[0.4em] text-xs text-center animate-pulse">Iniciando Servidores do Pet...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#080812] min-h-screen relative overflow-hidden font-satoshi flex flex-col">
      {!activeArtist && (
        <ArtistLoginOverlay gameName="Studio Pet" onSelect={setActiveArtist} />
      )}

      {/* BACKGROUND DECO */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
         <div className="absolute top-[-10%] right-[-10%] size-96 bg-primary/20 blur-[120px] rounded-full" />
         <div className="absolute bottom-[-10%] left-[-10%] size-96 bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      {/* TOP HEADER */}
      <header className="p-6 flex items-center justify-between sticky top-0 bg-[#080812]/80 backdrop-blur-xl z-30 border-b border-white/5">
         <div className="flex items-center gap-4">
            <Link to="/games" className="size-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white">
              <ChevronLeft className="size-5" />
            </Link>
            <div>
               <h1 className="text-lg font-cabinet font-black italic uppercase tracking-tighter text-white">Studio Pet <span className="text-primary text-xs ml-1">v2.0</span></h1>
               <div className="flex items-center gap-1.5">
                  <div className={`size-1.5 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
                  <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">{isSyncing ? 'Sincronizando Banco' : 'Sincronizado'}</p>
               </div>
            </div>
         </div>
         <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-2 group hover:bg-white/10 transition-colors">
            <Coins className="size-4 text-gold" />
            <span className="text-sm font-cabinet font-black italic text-gold">{activeArtist?.saldo?.toLocaleString() || 0}</span>
         </div>
      </header>

      {/* LOOT BANNER */}
      <AnimatePresence>
        {showLoot && (
          <motion.div 
            initial={{ y: -100 }} animate={{ y: 0 }} exit={{ y: -100 }}
            className="absolute top-24 left-6 right-6 z-[40] bg-primary p-5 rounded-[32px] flex items-center gap-4 shadow-[0_30px_60px_rgba(200,75,255,0.3)] border-2 border-white/20"
          >
             <div className="size-14 bg-black rounded-2xl flex items-center justify-center text-3xl shadow-inner">✨</div>
             <div className="flex-1">
                <h4 className="text-black font-cabinet font-black italic uppercase text-sm leading-tight">Drop de Estúdio!</h4>
                <p className="text-black/70 font-black uppercase text-[10px] tracking-tight">Seu mascote produziu <span className="text-black font-extrabold">{showLoot.amount} EC</span> pra você!</p>
             </div>
             <button onClick={() => setShowLoot(null)} className="bg-black/10 hover:bg-black/20 p-2 rounded-xl text-black transition-colors">
               <Info className="size-5" />
             </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN GAME AREA */}
      <main className="flex-1 p-6 flex flex-col gap-8 pb-32 overflow-y-auto">
         {/* STATUS GRID */}
         <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { id: 'hunger', label: 'Fome', icon: <Utensils className="size-4" />, val: pet.hunger, color: 'text-rose-400', trail: 'bg-rose-400/10' },
              { id: 'energy', label: 'Energia', icon: <Timer className="size-4" />, val: pet.energy, color: 'text-blue-400', trail: 'bg-blue-400/10' },
              { id: 'mood', label: 'Humor', icon: <Gamepad className="size-4" />, val: pet.mood, color: 'text-primary', trail: 'bg-primary/10' },
              { id: 'clean', label: 'Higiene', icon: <Sparkles className="size-4" />, val: pet.clean, color: 'text-cyan-400', trail: 'bg-cyan-400/10' }
            ].map(s => (
              <div key={s.id} className="bg-white/5 border border-white/10 p-5 rounded-[40px] flex flex-col items-center gap-4 hover:bg-white/10 transition-all group overflow-hidden relative">
                 <div className="absolute top-0 right-0 p-2 opacity-5 scale-150 rotate-12">{s.icon}</div>
                 <div className="relative size-20">
                    <svg className="size-full -rotate-90 filter drop-shadow-sm" viewBox="0 0 100 100">
                      <circle className="stroke-white/5 fill-none" strokeWidth="8" cx="50" cy="50" r="40" />
                      <circle 
                        className={`stroke-current fill-none transition-all duration-1000 ${s.color}`} 
                        strokeWidth="8" 
                        strokeDasharray={251.2} 
                        strokeDashoffset={251.2 - (251.2 * s.val) / 100} 
                        strokeLinecap="round" 
                        cx="50" cy="50" r="40" 
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-white/60 group-hover:scale-110 transition-transform">
                       {s.icon}
                    </div>
                 </div>
                 <div className="text-center">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">{s.label}</p>
                    <p className={`text-xl font-cabinet font-black italic ${s.color}`}>{Math.round(s.val)}%</p>
                 </div>
              </div>
            ))}
         </div>

         {/* PET VISUAL AREA */}
         <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center relative py-12 rounded-[60px] bg-white/[0.02] border border-white/5 overflow-hidden">
            <div className="absolute inset-0 bg-primary/2 blur-[80px] rounded-full pointer-events-none" />
            
            {/* FLOATING PARTICLES */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
               {[...Array(6)].map((_, i) => (
                 <motion.div 
                   key={i}
                   animate={{ 
                     y: [-20, 20, -20], 
                     x: [Math.random()*10, -Math.random()*10, Math.random()*10],
                     opacity: [0.1, 0.3, 0.1] 
                   }}
                   transition={{ repeat: Infinity, duration: 4 + Math.random()*2, delay: i }}
                   className="absolute size-2 bg-primary/20 rounded-full"
                   style={{ left: `${15 + i*15}%`, top: `${20 + (i%3)*20}%` }}
                 />
               ))}
            </div>

            <motion.div 
              animate={pet.isSleeping ? { scale: [1, 1.05, 1] } : { y: [0, -25, 0], scale: [1, 1.02, 1] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="relative size-64 sm:size-72 select-none group cursor-pointer"
              onClick={() => triggerPopText("❤️")}
            >
               {/* SOMBRA DINÂMICA */}
               <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-40 h-8 bg-black/40 blur-xl rounded-full scale-y-50 opacity-40 group-hover:scale-x-110 transition-transform" />
               
               {/* IMAGEM DO PET */}
               <div className={`w-full h-full rounded-[80px] overflow-hidden border-4 border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.5)] transition-all ${pet.isSleeping ? 'filter grayscale brightness-50' : 'group-hover:rotate-2'}`}>
                  <img 
                    src={getPetImage()} 
                    alt="Studio Pet" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
               </div>

               {/* POP TEXT ANIMATION */}
               <AnimatePresence>
                 {popText && (
                   <motion.div 
                     initial={{ opacity: 0, y: 0, scale: 0.5 }}
                     animate={{ opacity: 1, y: popText.y, scale: 1.5 }}
                     exit={{ opacity: 0 }}
                     style={{ position: 'absolute', left: `calc(50% + ${popText.x}px)`, top: '20%' }}
                     className="text-primary font-cabinet font-black text-2xl drop-shadow-[0_0_10px_rgba(200,75,255,0.8)] z-50 pointer-events-none"
                   >
                     {popText.text}
                   </motion.div>
                 )}
               </AnimatePresence>
               
               {/* Sleeping ZZZ */}
               <AnimatePresence>
                 {pet.isSleeping && (
                   <div className="absolute -right-8 -top-8 z-20">
                     <motion.span initial={{ opacity:0, y:0 }} animate={{ opacity:1, y:-40, x:20 }} exit={{ opacity:0 }} transition={{ repeat: Infinity, duration: 3 }} className="block text-4xl text-blue-400 font-black">Z</motion.span>
                     <motion.span initial={{ opacity:0, y:0 }} animate={{ opacity:1, y:-60, x:40 }} exit={{ opacity:0 }} transition={{ repeat: Infinity, duration: 3, delay: 1 }} className="block text-3xl text-blue-400/60 font-black">z</motion.span>
                     <motion.span initial={{ opacity:0, y:0 }} animate={{ opacity:1, y:-30, x:10 }} exit={{ opacity:0 }} transition={{ repeat: Infinity, duration: 3, delay: 2 }} className="block text-2xl text-blue-400/30 font-black">z</motion.span>
                   </div>
                 )}
               </AnimatePresence>
            </motion.div>
            
            <div className="mt-12 text-center relative z-10 px-8 py-3 bg-white/5 border border-white/5 rounded-full backdrop-blur-sm">
               <h3 className="text-white font-cabinet font-black italic uppercase text-sm tracking-widest">{activeArtist?.nome ? `${activeArtist.nome}'s Pet` : 'Mascote do Estúdio'}</h3>
               <p className="text-white/20 text-[9px] font-black uppercase tracking-[0.4em]">Design Experimental Empire RPG</p>
            </div>
         </div>

         {/* ACTIONS GRID */}
         <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { id: 'FEED', label: 'Alimentar', sub: `Custo: ${FEED_COST}`, icon: <Utensils className="size-6 text-rose-400" />, bg: 'bg-rose-400/10', border: 'border-rose-400/20' },
              { id: 'PLAY', label: 'Brincar', sub: `Custo: ${PLAY_COST}`, icon: <Gamepad className="size-6 text-primary" />, bg: 'bg-primary/10', border: 'border-primary/20' },
              { id: 'CLEAN', label: 'Limpar', sub: `Custo: ${CLEAN_COST}`, icon: <Sparkles className="size-6 text-cyan-400" />, bg: 'bg-cyan-400/10', border: 'border-cyan-400/20' },
              { id: 'SLEEP', label: 'Descansar', sub: '2H de Sono', icon: <Moon className="size-6 text-blue-400" />, bg: 'bg-blue-400/10', border: 'border-blue-400/20' }
            ].map(act => (
              <button 
                key={act.id}
                disabled={pet.isSleeping && act.id !== 'SLEEP'}
                onClick={() => handleAction(act.id as any)}
                className={`flex flex-col items-start gap-4 ${act.bg} border ${act.border} p-6 rounded-[40px] group active:scale-[0.98] transition-all disabled:opacity-20 relative overflow-hidden`}
              >
                 <div className="absolute top-0 right-0 size-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform" />
                 <div className="size-14 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-center relative z-10 shadow-lg">
                    {act.icon}
                 </div>
                 <div className="relative z-10 text-left">
                    <h4 className="text-white font-cabinet font-black italic uppercase group-hover:text-white transition-colors">{act.label}</h4>
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">{act.sub} EC</p>
                 </div>
              </button>
            ))}
         </div>

         {/* LOGS PANEL */}
         <div className="bg-white/5 border border-white/10 p-8 rounded-[50px] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 text-white"><History className="size-20" /></div>
            <div className="flex items-center gap-3 mb-6 relative z-10">
               <div className="size-8 bg-primary/20 rounded-xl flex items-center justify-center text-primary"><History className="size-4" /></div>
               <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Diário de Atividades</h4>
            </div>
            <div className="space-y-4 max-h-52 overflow-y-auto pr-2 scrollbar-thin relative z-10">
               {logs.map((log, i) => (
                 <motion.div initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} key={i} className="flex items-start gap-4 group">
                    <div className="size-8 bg-white/5 rounded-xl flex items-center justify-center text-lg shadow-sm">{log.icon}</div>
                    <div className="flex-1">
                       <p className="text-[12px] text-white/60 font-medium leading-relaxed">{log.msg}</p>
                       <span className="text-[9px] font-black text-white/10 uppercase tracking-widest group-hover:text-white/20 transition-colors">{log.time}</span>
                    </div>
                 </motion.div>
               ))}
               {logs.length === 0 && (
                 <div className="flex flex-col items-center py-10 opacity-20">
                    <Info className="size-10 mb-2" />
                    <p className="text-[10px] text-center italic uppercase font-black tracking-widest">Aguardando Eventos...</p>
                 </div>
               )}
            </div>
         </div>
      </main>

      {/* OVERLAYS & TOAST */}
      <AnimatePresence>
        {pet.isSleeping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-[#080812]/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center overflow-hidden">
             
             {/* BACKGROUND DECO FOR SLEEP */}
             <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] bg-blue-500/10 blur-[150px] rounded-full" />
                <div className="absolute inset-0 opacity-20 [background:radial-gradient(#fff_1px,transparent_1px)] [background-size:32px_32px]" />
             </div>

             <motion.div 
               animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
               transition={{ repeat: Infinity, duration: 6 }}
               className="size-56 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mb-10 relative z-10"
             >
                <Moon className="size-24 text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.5)]" />
                <div className="absolute inset-[-10%] border-2 border-dashed border-blue-400/20 rounded-full animate-[spin_20s_linear_infinite]" />
             </motion.div>

             <h2 className="text-4xl font-cabinet font-black italic uppercase text-white mb-3 tracking-tighter relative z-10">Mascote em <br/><span className="text-blue-400">Repouso Profundo</span></h2>
             
             <div className="bg-white/5 border border-white/10 px-8 py-4 rounded-3xl mb-8 relative z-10">
                <p className="text-blue-400/60 font-black uppercase text-[10px] tracking-widest mb-2 font-cabinet">Tempo Estimado</p>
                <p className="text-white text-4xl font-cabinet font-black italic tracking-tighter">{timeLeft}</p>
             </div>

             <p className="text-white/30 text-[11px] font-black uppercase tracking-[0.2em] leading-relaxed max-w-xs relative z-10 mb-12">
                O metabolismo do pet está operando em frequência baixa para recuperação térmica.
             </p>

             <Link to="/games" className="group relative z-10 flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 px-10 py-5 rounded-[30px] transition-all active:scale-95">
                <ChevronLeft className="size-5 text-white/50" />
                <span className="text-white font-cabinet font-black italic uppercase tracking-widest text-xs">Voltar ao Estúdio</span>
             </Link>
          </motion.div>
        )}

        {toast && (
          <motion.div 
            initial={{ y: 50, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 50, opacity: 0, scale: 0.8 }}
            className={`fixed bottom-24 left-6 right-6 z-[200] p-5 rounded-[30px] border shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-4 backdrop-blur-2xl ${
              toast.type === "ok" ? 'bg-green-500/20 border-green-500/40 text-green-400' : 
              toast.type === "bad" ? 'bg-red-500/20 border-red-500/40 text-red-400' :
              'bg-primary/20 border-primary/40 text-primary'
            }`}
          >
             <div className={`size-10 rounded-2xl flex items-center justify-center ${toast.type === 'ok' ? 'bg-green-500/20' : toast.type === 'bad' ? 'bg-red-500/20' : 'bg-primary/20'}`}>
                {toast.type === 'ok' ? <CheckCircle2 className="size-5" /> : toast.type === 'bad' ? <AlertCircle className="size-5" /> : <Sparkles className="size-5" />}
             </div>
             <span className="text-[11px] font-black uppercase tracking-widest leading-tight">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Subcomponente de Icone para mensagens de erro
function CheckCircle2({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22c5.522 0 10-4.478 10-10S17.522 2 12 2 2 6.478 2 12s4.478 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
  );
}

function AlertCircle({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
  );
}

export default StudioPetGame;
