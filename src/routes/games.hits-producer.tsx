import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ChevronLeft, 
  Trophy, 
  AlertTriangle, 
  RefreshCw,
} from "lucide-react";
import { api } from "../lib/api";
import { useTelegramUser } from "../lib/telegram";
import { ArtistLoginOverlay } from "../components/games/ArtistLoginOverlay";

export const Route = createFileRoute("/games/hits-producer")({
  component: HitsProducerGame,
});

// -- CONSTANTES E CONFIGURAÇÕES REAIS (Sincronizadas com seu game.js) --
const LANES = 4;
const HIT_ZONE_Y = 520;
const PERFECT_WINDOW = 15;
const GOOD_WINDOW = 40;
const GAME_DURATION = 45000; // 45 segundos de track
const HYPE_HIT_PERFECT = 8;
const HYPE_HIT_GOOD = 3;
const HYPE_MISS = 12;

type GameState = "START_SCREEN" | "LOADING" | "PLAYING" | "PAUSED" | "GAME_OVER" | "VICTORY";

class Note {
  lane: number;
  y: number;
  speed: number;
  dead: boolean = false;
  hit: boolean = false;

  constructor(lane: number, speed: number) {
    this.lane = lane;
    this.y = -50;
    this.speed = speed;
  }

  update(dt: number) {
    this.y += this.speed * dt * 60; // Compensação de delta time
    if (this.y > 600 + 30) this.dead = true;
  }
}

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number = 1.0;
  color: string;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 10;
    this.vy = (Math.random() - 0.5) * 10;
    this.color = color;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.2; // Gravidade leve
    this.life -= 0.03;
  }
}

function HitsProducerGame() {
  const { user } = useTelegramUser();
  const [gameState, setGameState] = useState<GameState>("START_SCREEN");
  const [activeArtist, setActiveArtist] = useState<any>(null);
  const [wager, setWager] = useState(50);
  const [currentInfo, setCurrentInfo] = useState({ score: 0, combo: 0, hype: 50, lives: 3, bpm: 120 });
  const [stats, setStats] = useState({ perfect: 0, good: 0, miss: 0, maxCombo: 0, won: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [pressedLanes, setPressedLanes] = useState<boolean[]>([false, false, false, false]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef({
    notes: [] as Note[],
    particles: [] as Particle[],
    active: false,
    bpm: 120,
    startTime: 0,
    lastSpawn: 0,
    score: 0,
    combo: 0,
    hype: 50,
    lives: 3,
    totalSpawned: 0,
    pressed: [false, false, false, false]
  });

  const syncCoins = async (wagerAmount: number, wonAmount: number) => {
    const tgId = user?.id || "";
    if (tgId === "guest") return { ok: true };
    try {
      return await api.syncGameCoins(tgId, wagerAmount, wonAmount, "Hits Producer", activeArtist?.nome);
    } catch (e) {
      console.error("Erro na sincronia Empire Hub:", e);
      return { ok: false };
    }
  };

  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const { notes, particles, pressed } = engineRef.current;
    ctx.clearRect(0, 0, width, height);

    // Fundo Gradiente Neon
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#08080f");
    grad.addColorStop(1, "#100820");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const laneW = width / LANES;
    const colors = ['#c84bff', '#4bf0ff', '#ff4b96', '#4bb4ff'];

    // Desenho das Lanes com Glassmorphism e Highlight de Pressionado
    for (let i = 0; i < LANES; i++) {
      // Base da Lane
      ctx.fillStyle = pressed[i] ? `rgba(${i === 0 ? '200,75,255' : i === 1 ? '75,240,255' : i === 2 ? '255,75,150' : '75,180,255'}, 0.15)` : `rgba(255, 255, 255, 0.03)`;
      ctx.fillRect(i * laneW, 0, laneW, height);
      
      // Linha divisória
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.beginPath(); ctx.moveTo(i * laneW, 0); ctx.lineTo(i * laneW, height); ctx.stroke();

      // Receptor (Circulo fixo)
      const cx = i * laneW + laneW/2;
      ctx.shadowBlur = pressed[i] ? 30 : 15;
      ctx.shadowColor = colors[i];
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = pressed[i] ? 4 : 3;
      ctx.beginPath(); ctx.arc(cx, HIT_ZONE_Y, pressed[i] ? 28 : 24, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Notas (Estilo Pixel-Art Glossy)
    notes.forEach(note => {
      const nx = note.lane * laneW + laneW / 2;
      ctx.shadowBlur = 20;
      ctx.shadowColor = colors[note.lane];
      ctx.fillStyle = colors[note.lane];
      ctx.beginPath();
      ctx.arc(nx, note.y, 22, 0, Math.PI*2);
      ctx.fill();
      
      // Detalhe interno da nota
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath(); ctx.arc(nx - 7, note.y - 7, 6, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Partículas
    particles.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 4, 4);
    });
    ctx.globalAlpha = 1;
  };

  const update = (t: number) => {
    if (!engineRef.current.active) return;
    const engine = engineRef.current;
    if (!engine.startTime) engine.startTime = t;
    const elapsed = t - engine.startTime;

    const dt = 1/60; // Delta fixo para estabilidade

    // Spawn de Notas progressivo
    const spawnRate = Math.max(200, 550 - (elapsed / 120));
    if (t - engine.lastSpawn > spawnRate) {
      const lane = Math.floor(Math.random() * LANES);
      const speed = 5.5 + (elapsed / 12000); // Acelera gradualmente
      engine.notes.push(new Note(lane, speed));
      engine.lastSpawn = t;
      engine.totalSpawned++;
    }

    engine.notes.forEach(n => {
      n.update(dt);
      if (n.y > HIT_ZONE_Y + 45 && !n.hit && !n.dead) {
        handleHit("MISS", n);
      }
    });

    engine.notes = engine.notes.filter(n => !n.dead);
    engine.particles.forEach(p => p.update());
    engine.particles = engine.particles.filter(p => p.life > 0);

    setCurrentInfo({ 
      score: engine.score, 
      combo: engine.combo, 
      hype: engine.hype, 
      lives: engine.lives, 
      bpm: engine.bpm 
    });

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) draw(ctx, canvas.width, canvas.height);
    }

    if (elapsed > GAME_DURATION) {
      finishGame(true);
      return;
    }

    requestAnimationFrame(update);
  };

  const handleHit = (type: "PERFECT" | "GOOD" | "MISS", note: Note) => {
    const engine = engineRef.current;
    note.hit = true;
    note.dead = true;

    if (type === "PERFECT") {
      engine.score += 20 * (1 + engine.combo * 0.05);
      engine.combo++;
      engine.hype = Math.min(100, engine.hype + HYPE_HIT_PERFECT);
      setStats(s => ({ ...s, perfect: s.perfect + 1, maxCombo: Math.max(s.maxCombo, engine.combo) }));
      spawnBurst(note.lane, "#D0FF43");
    } else if (type === "GOOD") {
      engine.score += 10;
      engine.combo++;
      engine.hype = Math.min(100, engine.hype + HYPE_HIT_GOOD);
      setStats(s => ({ ...s, good: s.good + 1, maxCombo: Math.max(s.maxCombo, engine.combo) }));
      spawnBurst(note.lane, "#44ffaa");
    } else {
      engine.combo = 0;
      engine.hype = Math.max(0, engine.hype - HYPE_MISS);
      engine.lives--;
      setStats(s => ({ ...s, miss: s.miss + 1 }));
      if (engine.hype <= 0 || engine.lives <= 0) finishGame(false);
    }
  };

  const spawnBurst = (lane: number, color: string) => {
    const width = canvasRef.current?.width || 400;
    const x = lane * (width / LANES) + (width / LANES) / 2;
    for (let i = 0; i < 15; i++) {
      engineRef.current.particles.push(new Particle(x, HIT_ZONE_Y, color));
    }
  };

  const processInput = (lane: number) => {
    if (gameState !== "PLAYING") return;
    const engine = engineRef.current;

    // Efeito visual imediato
    engine.pressed[lane] = true;
    const newPressed = [...pressedLanes];
    newPressed[lane] = true;
    setPressedLanes(newPressed);
    
    setTimeout(() => {
      engine.pressed[lane] = false;
      const resetPressed = [...pressedLanes];
      resetPressed[lane] = false;
      setPressedLanes(resetPressed);
    }, 100);

    const target = engine.notes
      .filter(n => n.lane === lane && !n.hit && !n.dead)
      .sort((a,b) => Math.abs(a.y - HIT_ZONE_Y) - Math.abs(b.y - HIT_ZONE_Y))[0];

    if (!target) return;
    const dist = Math.abs(target.y - HIT_ZONE_Y);

    if (dist < PERFECT_WINDOW + 5) handleHit("PERFECT", target); // Janela levemente maior para mobile
    else if (dist < GOOD_WINDOW + 5) handleHit("GOOD", target);
  };

  const handleStart = async () => {
    setIsSyncing(true);
    setGameState("LOADING");
    
    const deduct = await syncCoins(wager, 0);
    if (!deduct.ok) {
      alert("Saldo insuficiente!");
      setGameState("START_SCREEN");
      setIsSyncing(false);
      return;
    }

    engineRef.current = {
      notes: [], particles: [], active: true, bpm: 120,
      startTime: 0, lastSpawn: 0, score: 0, combo: 0,
      hype: 50, lives: 3, totalSpawned: 0,
      pressed: [false, false, false, false]
    };
    
    setStats({ perfect: 0, good: 0, miss: 0, maxCombo: 0, won: 0 });
    setGameState("PLAYING");
    setIsSyncing(false);
    requestAnimationFrame(update);
  };

  const finishGame = async (victory: boolean) => {
    engineRef.current.active = false;
    if (victory) {
      const accuracy = (stats.perfect + stats.good) / (engineRef.current.totalSpawned || 1);
      const wonAmount = Math.floor(wager * 2.0 * accuracy * (1 + stats.maxCombo / 50));
      setStats(s => ({ ...s, won: wonAmount }));
      setGameState("VICTORY");
      setIsSyncing(true);
      await syncCoins(0, wonAmount);
      setIsSyncing(false);
    } else {
      setGameState("GAME_OVER");
    }
  };

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      const keys: Record<string, number> = { 'd': 0, 'f': 1, 'j': 2, 'k': 3, 'D': 0, 'F': 1, 'J': 2, 'K': 3 };
      if (keys[e.key] !== undefined) processInput(keys[e.key]);
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [gameState]);

  return (
    <div className="flex-1 bg-black min-h-screen relative overflow-hidden font-satoshi select-none touch-none">
      <ArtistLoginOverlay onSelect={setActiveArtist} gameName="Hits Producer" />
      {/* HUD - TOP SECTION */}
      <div className="absolute top-0 left-0 right-0 p-6 z-40 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link to="/games" className="size-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-xl">
            <ChevronLeft className="size-6" />
          </Link>
          
          <div className="flex flex-col items-center bg-black/40 px-6 py-2 rounded-2xl border border-white/10 backdrop-blur-md">
            <div className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] mb-1">PONTUAÇÃO</div>
            <div className="text-3xl font-cabinet font-black text-white italic tracking-tighter leading-none">
              {Math.floor(currentInfo.score).toLocaleString()}
            </div>
          </div>

          <div className="flex flex-col items-end">
             <div className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] mb-1">COMBO</div>
             <div className="text-3xl font-cabinet font-black text-primary italic leading-none drop-shadow-[0_0_10px_#C84BFF]">x{currentInfo.combo}</div>
          </div>
        </div>

        {/* HUD LIVES & HYPE */}
        <div className="flex items-center justify-between bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-[24px]">
          <div className="flex gap-1.5 text-xl">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className={`transition-all duration-300 ${i < currentInfo.lives ? "opacity-100 scale-100" : "opacity-20 scale-75 grayscale"}`}>❤️</span>
            ))}
          </div>

          <div className="flex-1 max-w-[200px] ml-10">
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-[9px] font-black uppercase text-primary tracking-[0.1em]">Hype Meter</span>
              <span className="text-[10px] font-black text-white">{Math.floor(currentInfo.hype)}%</span>
            </div>
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden border border-white/5 relative">
              <motion.div 
                className="h-full bg-gradient-to-r from-green-400 to-primary shadow-[0_0_15px_rgba(208,255,67,0.5)]"
                animate={{ width: `${currentInfo.hype}%` }}
                initial={{ width: "50%" }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* GAME CANVAS */}
      <div className="relative h-full flex items-center justify-center pt-32 pb-40">
        <canvas 
          ref={canvasRef}
          width={400}
          height={640}
          className="h-full w-full max-w-[420px] object-contain"
          onTouchStart={(e) => {
             e.preventDefault();
             const rect = canvasRef.current?.getBoundingClientRect();
             if (!rect) return;
             const touch = e.touches[0];
             const tx = touch.clientX - rect.left;
             const lane = Math.floor(tx / (rect.width / LANES));
             processInput(Math.max(0, Math.min(LANES - 1, lane)));
          }}
          onMouseDown={(e) => {
             const rect = canvasRef.current?.getBoundingClientRect();
             if (!rect) return;
             const tx = e.clientX - rect.left;
             const lane = Math.floor(tx / (rect.width / LANES));
             processInput(Math.max(0, Math.min(LANES - 1, lane)));
          }}
        />

        {/* Tap areas visuais do mobile */}
        <div className="absolute inset-0 z-30 pointer-events-none flex">
          {Array.from({ length: LANES }).map((_, i) => (
            <div key={i} className={`flex-1 transition-colors duration-100 ${pressedLanes[i] ? 'bg-white/5' : 'bg-transparent'}`} />
          ))}
        </div>
      </div>

      {/* FOOTER TAP GUIDE - Agora Funcional para Mobile */}
      <div className="absolute bottom-6 left-0 right-0 px-6 grid grid-cols-4 gap-4 z-50">
         {['D','F','J','K'].map((k, i) => (
           <button 
            key={k} 
            onTouchStart={(e) => { e.preventDefault(); processInput(i); }}
            onMouseDown={() => processInput(i)}
            className={`h-24 border-2 rounded-[32px] flex items-center justify-center transition-all active:scale-95 ${pressedLanes[i] ? 'bg-primary border-black scale-105' : 'bg-white/5 border-white/10'}`}
           >
              <span className={`font-cabinet font-black text-2xl italic tracking-widest ${pressedLanes[i] ? 'text-black' : 'text-white/20'}`}>{k}</span>
           </button>
         ))}
      </div>

      {/* SCREENS OVERLAY */}
      <AnimatePresence>
        {gameState === "START_SCREEN" && (
          <motion.div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mb-12">
              <h1 className="text-7xl font-cabinet font-black italic uppercase leading-none tracking-tighter text-white">
                🎵 O Produtor<br/><span className="text-primary italic drop-shadow-[0_0_20px_#C84BFF]">de Hits</span>
              </h1>
              <p className="text-white/50 text-[11px] font-bold uppercase tracking-[0.5em] mt-6">Acerte o ritmo. Construa seu Império.</p>
            </div>
            
            <div className="w-full max-w-sm space-y-12">
              <div className="bg-white/5 border border-white/10 p-10 rounded-[48px] backdrop-blur-xl">
                <p className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-8">Defina sua Aposta:</p>
                <div className="grid grid-cols-3 gap-5">
                  {[50, 100, 200].map(val => (
                    <button 
                      key={val} 
                      onClick={() => setWager(val)}
                      className={`relative h-24 rounded-[32px] border-2 font-cabinet font-black transition-all shadow-[0_10px_20px_rgba(0,0,0,0.4)] ${wager === val ? 'bg-primary border-black text-black scale-110' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                    >
                      <div className="text-[10px] opacity-50 uppercase mb-1">EC</div>
                      <div className="text-3xl italic leading-none">{val}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                 <p className="text-[9px] font-bold text-white/30 uppercase leading-relaxed tracking-widest">
                   🎯 PERFECT = +20pts | ❤️ PRECISÃO = +VIDA | 💀 ERRO = -VIDA <br/>
                   Teclas desktop: D F J K
                 </p>
                 
                 <button 
                  onClick={handleStart}
                  className="group relative w-full h-24 bg-white text-black rounded-[36px] overflow-hidden transition-all hover:scale-[1.03] active:scale-95 shadow-[0_30px_60px_rgba(255,255,255,0.1)] border-4 border-black"
                >
                  <div className="relative z-10 font-cabinet font-black uppercase italic tracking-[0.3em] text-2xl">GRAVAR HIT 🎶</div>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === "LOADING" && (
          <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center">
            <div className="size-20 border-[6px] border-primary border-t-transparent rounded-full animate-spin mb-8 shadow-[0_0_30px_rgba(208,255,67,0.2)]" />
            <p className="text-primary font-cabinet font-black uppercase italic tracking-[0.4em] text-sm animate-pulse">Preparando o estúdio...</p>
          </div>
        )}

        {gameState === "VICTORY" && (
          <motion.div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-8 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="size-28 bg-primary text-black rounded-[40px] flex items-center justify-center mb-10 shadow-[0_0_60px_rgba(208,255,67,0.6)] border-4 border-black animate-bounce">
              <Trophy className="size-14" />
            </div>
            
            <h2 className="text-7xl font-cabinet font-black italic uppercase text-white mb-2 leading-none tracking-tighter">🏆 VITÓRIA!</h2>
            <p className="text-white/40 text-[10px] font-black uppercase mb-14 tracking-[0.4em]">Sua track dominou as paradas mundiais!</p>

            <div className="bg-primary text-black p-12 rounded-[56px] border-4 border-black w-full max-w-sm mb-12 relative overflow-hidden group shadow-[0_30px_60px_rgba(208,255,67,0.2)]">
               <span className="text-[11px] font-black uppercase opacity-60 italic mb-3 tracking-[0.2em] block">Recompensa Total</span>
               <span className="text-7xl font-cabinet font-black italic leading-none">{stats.won.toLocaleString()} <span className="text-2xl">EC</span></span>
               <div id="vic-saving" className={isSyncing ? "mt-6 flex items-center justify-center gap-2 text-[11px] font-black" : "hidden"}>
                  <RefreshCw className="size-4 animate-spin" /> SALVANDO...
               </div>
            </div>

            <div className="space-y-4 w-full max-w-xs">
              <button 
                onClick={handleStart}
                disabled={isSyncing}
                className="w-full h-20 bg-white text-black font-cabinet font-black uppercase italic tracking-widest text-lg rounded-[28px] border-4 border-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                Jogar Novamente
              </button>
              <Link to="/games" className="w-full h-14 text-white/40 font-black uppercase text-xs tracking-[0.2em] block hover:text-white transition-colors flex items-center justify-center underline decoration-primary underline-offset-8">Voltar ao Menu</Link>
            </div>
          </motion.div>
        )}

        {gameState === "GAME_OVER" && (
          <motion.div className="fixed inset-0 z-[70] bg-[#1a0505] flex flex-col items-center justify-center p-8 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <AlertTriangle className="size-28 text-red-600 mb-10 drop-shadow-[0_0_20px_rgba(255,0,0,0.4)]" />
            <h2 className="text-7xl font-cabinet font-black italic uppercase text-white mb-2 leading-[0.85] tracking-tighter">💀 GAME OVER</h2>
            <p className="text-red-600/80 text-[10px] font-black uppercase mb-14 tracking-[0.3em]">Hype expirado. Track descartada pela gravadora.</p>
            
            <div className="bg-white/5 border border-white/10 p-12 rounded-[56px] w-full max-w-xs mb-14 backdrop-blur-xl">
               <span className="text-[10px] font-black uppercase text-white/30 block mb-3 tracking-widest">Saldo de Investimento</span>
               <span className="text-5xl font-cabinet font-black text-red-600 italic">-{wager} EC</span>
            </div>

            <div className="w-full max-w-xs space-y-5">
              <button 
                onClick={() => setGameState("START_SCREEN")} 
                className="w-full h-24 bg-red-600 text-white rounded-[32px] font-cabinet font-black uppercase italic tracking-widest text-xl border-4 border-black transition-all hover:scale-105 shadow-[0_20px_40px_rgba(255,0,0,0.2)]"
              >
                Tentar denovo
              </button>
              <Link to="/games" className="w-full h-12 text-white/30 font-black uppercase text-xs tracking-widest block hover:text-white transition-colors flex items-center justify-center">Sair do Estúdio</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default HitsProducerGame;
