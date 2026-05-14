import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ChevronLeft, 
  Camera, 
  Zap, 
  Coins, 
  Music, 
  AlertTriangle,
  RefreshCw,
  Trophy,
  Navigation,
  Star
} from "lucide-react";
import { api } from "../lib/api";
import { useTelegramUser } from "../lib/telegram";
import { ArtistLoginOverlay } from "../components/games/ArtistLoginOverlay";

export const Route = createFileRoute("/games/paparazzi-escape")({
  component: PaparazziEscapeGame,
});

// -- CONFIGURAÇÕES --
const ENTRY_FEE = 50;
const OBSTACLE_SPEED_BASE = 0.02; // Velocidade de aproximação (0.0 a 1.0)
const OBSTACLE_SPEED_INC = 0.00005;
const SPAWN_RATE_BASE = 1200; // ms

type GameState = "MENU" | "LOADING" | "RUNNING" | "CASHOUT" | "DEAD" | "SUCCESS";

interface Entity {
  z: number; // 1.0 (horizonte) a 0.0 (jogador)
  lane: number; // -1, 0, 1
  type: "CAMERA" | "COIN";
  alive: boolean;
  id: number;
}

function PaparazziEscapeGame() {
  const { user } = useTelegramUser();
  const [gameState, setGameState] = useState<GameState>("MENU");
  const [activeArtist, setActiveArtist] = useState<any>(null); // Login
  const [gameInfo, setGameInfo] = useState({ coins: 0, distance: 0 });
  const [finalStats, setFinalStats] = useState({ won: 0, dist: 0 });
  const [isSyncing, setIsSyncing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef({
    lane: 0,
    targetLane: 0,
    entities: [] as Entity[],
    speed: OBSTACLE_SPEED_BASE,
    active: false,
    distance: 0,
    sessionCoins: 0,
    frameCount: 0,
    flash: 0,
    lastSpawn: 0,
    speedLines: [] as { x: number, y: number, length: number }[]
  });

  const syncCoins = async (wager: number, won: number) => {
    const tgId = user?.id || "";
    if (tgId === "guest") return { ok: true };
    try {
      return await api.syncGameCoins(tgId, wager, won, "Paparazzi Escape", activeArtist?.nome);
    } catch (e) {
      console.error("Erro Hub:", e);
      return { ok: false };
    }
  };

  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const engine = engineRef.current;
    ctx.clearRect(0, 0, width, height);

    // 1. SKY / HORIZON
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#050510");
    sky.addColorStop(0.45, "#1a0b3e");
    sky.addColorStop(0.5, "#4b1b6e");
    sky.addColorStop(0.55, "#050510");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const horizonY = height * 0.45;
    const vanishingPointX = width / 2;

    // 2. SPEED LINES (Neon streaking)
    ctx.strokeStyle = "rgba(255, 75, 170, 0.4)";
    ctx.lineWidth = 2;
    engine.speedLines.forEach(line => {
      ctx.beginPath();
      ctx.moveTo(line.x, line.y);
      ctx.lineTo(line.x, line.y + line.length);
      ctx.stroke();
      line.y += engine.speed * 4000;
      if (line.y > height) {
        line.y = -50;
        line.x = Math.random() * width;
      }
    });

    // 3. ROAD (Perspective)
    // Road Base
    ctx.fillStyle = "#0c0818";
    ctx.beginPath();
    ctx.moveTo(vanishingPointX - 10, horizonY);
    ctx.lineTo(vanishingPointX + 10, horizonY);
    ctx.lineTo(width * 1.8, height);
    ctx.lineTo(-width * 0.8, height);
    ctx.fill();

    // Road Markings (Converging lines)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 2;
    [-0.5, 0.5, -1.5, 1.5].forEach(lX => {
      ctx.beginPath();
      ctx.moveTo(vanishingPointX + lX * 5, horizonY);
      ctx.lineTo(vanishingPointX + lX * width * 1.2, height);
      ctx.stroke();
    });

    // 4. ENTITIES (Sorted by depth)
    engine.entities.sort((a, b) => b.z - a.z).forEach(ent => {
      const screenZ = 1 - ent.z; // 0 no horizonte, 1 perto
      const xBase = vanishingPointX + (ent.lane * width * 0.4 * screenZ);
      const yBase = horizonY + (screenZ * (height - horizonY));
      const scale = 0.1 + (screenZ * 2.0); // Aumenta conforme aproxima
      const size = 60 * scale;

      if (ent.type === "CAMERA") {
        // Redraw Camera based on image reference
        ctx.save();
        ctx.translate(xBase, yBase - size/2);
        
        // Body
        ctx.fillStyle = "#111";
        ctx.strokeStyle = "#444";
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.roundRect(-size/2, -size/2, size, size, 4 * scale);
        ctx.fill();
        ctx.stroke();

        // Lens
        ctx.shadowBlur = 10 * scale;
        ctx.shadowColor = "#fff";
        ctx.fillStyle = Math.sin(Date.now()/50) > 0 ? "#fff" : "#333";
        ctx.beginPath(); ctx.arc(0, 0, size/3, 0, Math.PI*2); ctx.fill();

        // Flash Light Bar
        ctx.fillStyle = "#222";
        ctx.fillRect(-size/2 + 5*scale, -size/1.5, size - 10*scale, size/4);
        
        ctx.restore();
      } else if (ent.type === "COIN") {
        // Neon Gold Coin
        ctx.save();
        ctx.translate(xBase, yBase - size/3);
        ctx.shadowBlur = 15 * scale;
        ctx.shadowColor = "#ffcc00";
        ctx.fillStyle = "#ffcc00";
        const cRot = Math.sin(Date.now()/200);
        ctx.beginPath();
        ctx.ellipse(0, 0, (size/3) * (0.8 + Math.abs(cRot)*0.2), size/3, cRot * 0.1, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
    });

    // 5. PLAYER (Pop Star silhouette/orb)
    const playerX = vanishingPointX + (engine.lane * width * 0.35);
    const playerY = height - 140;
    const bounce = Math.sin(Date.now() / 150) * 8;

    ctx.save();
    ctx.shadowBlur = 35;
    ctx.shadowColor = "#ff4baa";
    ctx.fillStyle = "#ff4baa";
    ctx.beginPath(); ctx.arc(playerX, playerY + bounce, 45, 0, Math.PI*2); ctx.fill();
    // Inner white star
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    for(let i=0; i<5; i++) {
       const ra = (i * 0.8 * Math.PI) - Math.PI/2;
       ctx.lineTo(playerX + Math.cos(ra)*15, playerY + bounce + Math.sin(ra)*15);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // 6. FLASH BURST (When dead)
    if (engine.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${engine.flash})`;
      ctx.fillRect(0, 0, width, height);
      engine.flash -= 0.04;
    }
  };

  const update = (t: number) => {
    if (!engineRef.current.active) return;
    const engine = engineRef.current;
    const dt = 1/60;

    // Lane logic
    engine.lane += (engine.targetLane - engine.lane) * 0.15;

    // Entity logic
    engine.entities.forEach(ent => {
      ent.z -= engine.speed;
      
      // Collision
      if (ent.z < 0.1 && ent.alive) {
        if (Math.abs(ent.lane - engine.lane) < 0.4) {
          if (ent.type === "CAMERA") {
            handleDeath();
          } else {
            ent.alive = false;
            engine.sessionCoins += 25;
            setGameInfo(i => ({ ...i, coins: engine.sessionCoins }));
          }
        }
      }
    });
    engine.entities = engine.entities.filter(e => e.z > 0 && e.alive);

    // Spawning
    const spawnRate = Math.max(400, SPAWN_RATE_BASE - (engine.distance * 0.5));
    if (t - engine.lastSpawn > spawnRate) {
       const lane = Math.floor(Math.random() * 3) - 1;
       const type = Math.random() > 0.4 ? "CAMERA" : "COIN";
       engine.entities.push({ z: 1.0, lane, type, alive: true, id: t });
       engine.lastSpawn = t;
    }

    engine.distance += engine.speed * 200;
    engine.speed += OBSTACLE_SPEED_INC;

    if (engine.frameCount % 10 === 0) {
       setGameInfo(i => ({ ...i, distance: engine.distance }));
    }
    engine.frameCount++;

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) draw(ctx, canvas.width, canvas.height);
    }

    requestAnimationFrame(update);
  };

  const changeLane = (dir: number) => {
    if (gameState !== "RUNNING") return;
    const engine = engineRef.current;
    engine.targetLane = Math.max(-1, Math.min(1, engine.targetLane + dir));
  };

  const handleDeath = () => {
    const engine = engineRef.current;
    engine.active = false;
    engine.flash = 1.0;
    setGameState("DEAD");
    syncCoins(ENTRY_FEE, 0);
  };

  const handleStart = async () => {
    setIsSyncing(true);
    setGameState("LOADING");
    
    const deduct = await syncCoins(ENTRY_FEE, 0);
    if (!deduct.ok) {
      alert("Saldo insuficiente!");
      setGameState("MENU");
      setIsSyncing(false);
      return;
    }

    engineRef.current = {
      lane: 0, targetLane: 0, entities: [], speed: OBSTACLE_SPEED_BASE,
      active: true, distance: 0, sessionCoins: 0, frameCount: 0, flash: 0,
      lastSpawn: 0,
      speedLines: Array.from({ length: 30 }).map(() => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        length: Math.random() * 80 + 40
      }))
    };
    
    setGameInfo({ coins: 0, distance: 0 });
    setGameState("RUNNING");
    setIsSyncing(false);
    requestAnimationFrame(update);
  };

  const handleCashout = async () => {
    const engine = engineRef.current;
    engine.active = false;
    setGameState("CASHOUT");
    setIsSyncing(true);
    
    setFinalStats({ won: engine.sessionCoins, dist: engine.distance });
    await syncCoins(0, engine.sessionCoins);
    setGameState("SUCCESS");
    setIsSyncing(false);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") changeLane(-1);
      if (e.code === "ArrowRight" || e.code === "KeyD") changeLane(1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [gameState]);

  return (
    <div className="flex-1 bg-black min-h-screen relative overflow-hidden font-satoshi select-none touch-none">
      <ArtistLoginOverlay onSelect={setActiveArtist} gameName="Paparazzi Escape" />
      {/* 1. TOP HUD (Cinematográfico) */}
      <div className="absolute top-0 left-0 right-0 p-6 z-40 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link to="/games" className="size-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-xl">
            <ChevronLeft className="size-6" />
          </Link>
          
          <div className="flex flex-col items-center bg-black/40 px-8 py-3 rounded-3xl border border-white/10 backdrop-blur-md">
            <div className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em] mb-1">DISTÂNCIA</div>
            <div className="text-4xl font-cabinet font-black text-white italic tracking-tighter leading-none">
              {Math.floor(gameInfo.distance).toLocaleString()}<span className="text-sm ml-1 text-primary">m</span>
            </div>
          </div>

          <button className="size-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white">
            <div className="flex gap-1">
               <div className="w-1.5 h-4 bg-white rounded-full"></div>
               <div className="w-1.5 h-4 bg-white rounded-full"></div>
            </div>
          </button>
        </div>

        {/* Legend Bar */}
        <div className="w-full h-8 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-4 flex items-center gap-4">
           <Star className="size-4 text-primary fill-primary shadow-[0_0_10px_#ff4baa]" />
           <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-primary to-secondary"
                animate={{ width: `${(gameInfo.distance % 2500) / 25}%` }}
              />
           </div>
           <div className="text-[10px] font-black text-white/60 tracking-wider">2.500 m 🏁</div>
        </div>
      </div>

      {/* 2. COIN BADGE */}
      <div className="absolute top-44 left-6 z-40 bg-black/60 border border-white/10 backdrop-blur-xl px-5 py-3 rounded-full flex items-center gap-3">
         <div className="size-8 bg-gold rounded-full flex items-center justify-center shadow-[0_0_20px_#ffcc00] border-2 border-black">
            <span className="text-black font-black text-xs">$</span>
         </div>
         <div className="text-2xl font-cabinet font-black text-white leading-none">{gameInfo.coins}</div>
      </div>

      {/* 3. GAME CANVAS */}
      <canvas 
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="block h-full w-full"
        onTouchStart={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          const tx = e.touches[0].clientX;
          if (tx < rect.width / 2) changeLane(-1);
          else changeLane(1);
        }}
      />

      {/* 4. FUGIR ACTION (Principal) */}
      <AnimatePresence>
        {gameState === "RUNNING" && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0, y: 50 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="absolute bottom-16 right-6 z-40"
          >
            <button 
              onClick={handleCashout}
              className="bg-[#22c55e] px-10 py-7 rounded-[40px] border-4 border-black shadow-[0_15px_0_#15803d,0_40px_60px_rgba(34,197,94,0.4)] flex flex-col items-center group active:translate-y-2 active:shadow-[0_5px_0_#15803d] transition-all"
            >
              <div className="text-black font-cabinet font-black text-5xl italic leading-none tracking-tighter flex items-center gap-3">
                FUGIR <Coins className="size-8" />
              </div>
              <p className="text-black/50 text-[10px] font-black uppercase tracking-widest mt-1">Garantir Lucro Agora</p>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. CHARACTER PROFILE CARD (Bottom) */}
      <div className="absolute bottom-12 left-6 z-40 flex items-center gap-4 bg-black/60 backdrop-blur-2xl p-4 rounded-[40px] border border-white/10 min-w-[280px]">
         <div className="size-20 rounded-full border-4 border-primary overflow-hidden bg-primary/20 p-1">
            <img src="https://images.unsplash.com/photo-1514525253361-bee8718a74a2?q=80&w=150&h=150&auto=format&fit=crop" className="w-full h-full object-cover rounded-full" alt="Profile" />
         </div>
         <div className="flex-1">
            <div className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-1.5 flex items-center gap-2">
               POP STAR <Star className="size-3 text-primary fill-primary" />
            </div>
            <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/5 p-1 relative">
               <motion.div 
                className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full" 
                initial={{ width: "0%" }}
                animate={{ width: "85%" }} 
                transition={{ duration: 1 }}
               />
               <Navigation className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-1 size-3 text-white fill-white rotate-45" />
            </div>
         </div>
      </div>

      {/* OVERLAYS */}
      <AnimatePresence>
        {gameState === "MENU" && (
          <motion.div className="fixed inset-0 z-50 bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mb-14 relative">
              <div className="absolute -inset-20 bg-primary/20 blur-[100px] rounded-full animate-pulse" />
              <Camera className="size-24 text-primary mx-auto mb-10 drop-shadow-[0_0_40px_#ff4baa] relative" />
              <h1 className="text-7xl font-cabinet font-black italic uppercase leading-[0.8] tracking-tighter text-white">
                Fuga do<br/><span className="text-primary italic">Paparazzi</span>
              </h1>
              <p className="text-white/40 text-[11px] font-bold uppercase tracking-[0.5em] mt-8">NÃO DEIXE O FLASH TE ALCANÇAR.</p>
            </div>
            
            <div className="w-full max-w-sm space-y-12">
              <div className="bg-white/5 border border-white/10 p-10 rounded-[56px] backdrop-blur-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                   <Star className="size-20" />
                </div>
                <div className="flex justify-between items-center mb-8">
                  <span className="text-[11px] font-black uppercase text-white/30 tracking-widest">Fee de Entrada</span>
                  <span className="text-3xl font-cabinet font-black text-gold italic">50 EC</span>
                </div>
                <div className="space-y-4 text-left">
                  <div className="flex items-center gap-5">
                    <div className="size-11 bg-white/10 rounded-2xl flex items-center justify-center font-black text-lg">A D</div>
                    <p className="text-[10px] font-black text-white/50 uppercase leading-snug">Troque de pista para desviar das câmeras.</p>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="size-11 bg-green-500/20 rounded-2xl flex items-center justify-center font-black text-green-400">!!</div>
                    <p className="text-[10px] font-black text-white/50 uppercase leading-snug">FUGIR garante seu saldo acumulado. É o seu lucro!</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleStart}
                className="group relative w-full h-24 bg-white text-black rounded-[40px] overflow-hidden transition-all hover:scale-[1.05] active:scale-95 shadow-[0_30px_60px_rgba(255,255,255,0.15)] border-4 border-black"
              >
                <div className="relative z-10 font-cabinet font-black uppercase italic tracking-[0.3em] text-2xl">CORRER DO FLASH 🎬</div>
              </button>
            </div>
          </motion.div>
        )}

        {gameState === "LOADING" && (
          <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center">
            <div className="size-24 border-[8px] border-primary border-t-transparent rounded-full animate-spin mb-10 shadow-[0_0_50px_rgba(255,75,170,0.3)]" />
            <p className="text-primary font-cabinet font-black uppercase italic tracking-[0.5em] text-sm animate-pulse">Despistando fãs e jornalistas...</p>
          </div>
        )}

        {gameState === "SUCCESS" && (
          <motion.div className="fixed inset-0 z-[70] bg-black/98 flex flex-col items-center justify-center p-8 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="size-32 bg-green-500 text-black rounded-[48px] flex items-center justify-center mb-10 shadow-[0_0_80px_rgba(34,197,94,0.6)] border-4 border-black animate-bounce rotate-12">
              <Trophy className="size-16" />
            </div>
            
            <h2 className="text-8xl font-cabinet font-black italic uppercase text-white mb-2 leading-[0.8] tracking-tighter">VOCÊ <br/> <span className="text-green-500">FUGIU!</span></h2>
            <p className="text-white/30 text-[11px] font-black uppercase mb-16 tracking-[0.5em]">As fotos não saíram. O cachê é seu.</p>

            <div className="bg-green-500 text-black p-14 rounded-[70px] border-4 border-black w-full max-w-sm mb-14 shadow-[0_45px_100px_rgba(34,197,94,0.35)] relative overflow-hidden group">
               <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
               <span className="text-[12px] font-black uppercase opacity-60 italic mb-3 tracking-[0.3em] block">Cachê Garantido</span>
               <span className="text-8xl font-cabinet font-black italic leading-none">{finalStats.won.toLocaleString()} <span className="text-3xl">EC</span></span>
               {isSyncing && <div className="mt-6 text-[10px] uppercase font-black tracking-widest animate-pulse italic">Processando Depósito...</div>}
            </div>

            <div className="space-y-5 w-full max-w-xs">
              <button 
                onClick={handleStart}
                disabled={isSyncing}
                className="w-full h-20 bg-white text-black font-cabinet font-black uppercase italic tracking-widest text-xl rounded-[32px] border-4 border-black transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
              >
                Nova Rodada
              </button>
              <Link to="/games" className="w-full h-12 text-white/30 font-black uppercase text-xs tracking-widest block hover:text-white transition-colors flex items-center justify-center decoration-green-500 decoration-2 underline-offset-8">Voltar ao Menu Principal</Link>
            </div>
          </motion.div>
        )}

        {gameState === "DEAD" && (
          <motion.div className="fixed inset-0 z-[70] bg-[#1a0101] flex flex-col items-center justify-center p-8 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <AlertTriangle className="size-32 text-red-600 mb-12 drop-shadow-[0_0_30px_rgba(255,0,0,0.6)] animate-pulse" />
            <h2 className="text-8xl font-cabinet font-black italic uppercase text-white mb-2 leading-[0.8] tracking-tighter">FOTO <br/><span className="text-red-600">VASADA!</span></h2>
            <p className="text-red-600/60 text-[11px] font-black uppercase mb-16 tracking-[0.4em]">O flash te cegou. O lucro evaporou.</p>
            
            <div className="bg-white/5 border border-white/10 p-12 rounded-[64px] w-full max-w-xs mb-16 backdrop-blur-3xl">
               <span className="text-[11px] font-black uppercase text-white/20 block mb-4 tracking-widest">Saldo Perdido</span>
               <span className="text-6xl font-cabinet font-black text-red-600 italic">-{ENTRY_FEE} EC</span>
            </div>

            <div className="w-full max-w-xs space-y-6">
              <button 
                onClick={handleStart} 
                className="w-full h-24 bg-red-600 text-white rounded-[40px] font-cabinet font-black uppercase italic tracking-widest text-2xl border-4 border-black transition-all hover:scale-105 shadow-[0_25px_50px_rgba(220,38,38,0.4)]"
              >
                TENTAR DENOVO
              </button>
              <Link to="/games" className="w-full h-12 text-white/20 font-black uppercase text-xs tracking-widest block hover:text-white transition-colors flex items-center justify-center italic">Desistir do Estúdio</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PaparazziEscapeGame;
