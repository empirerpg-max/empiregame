import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic2, 
  Guitar, 
  Disc, 
  Crown, 
  Music, 
  Star, 
  Diamond, 
  Radio, 
  Timer, 
  Target, 
  RotateCcw,
  Trophy,
  History,
  Coins,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useTelegramUser } from '../../lib/telegram';
import { api, Artist } from '../../lib/api';
import { toast } from 'sonner';

// --- TYPES ---
type GameState = 'MENU' | 'PLAYING' | 'TIME_UP' | 'VICTORY' | 'SAVING';

interface Card {
  id: number;
  pairId: number;
  icon: React.ReactNode;
  label: string;
  isFlipped: boolean;
  isMatched: boolean;
}

// --- CONSTANTS ---
const GAME_DURATION = 60; // seconds
const ENTRY_FEE = 30; // coins
const ICON_POOL = [
  { id: 1, icon: <Mic2 className="w-8 h-8" />, label: 'Microfone' },
  { id: 2, icon: <Guitar className="w-8 h-8" />, label: 'Guitarra' },
  { id: 3, icon: <Disc className="w-8 h-8" />, label: 'DJ Control' },
  { id: 4, icon: <Crown className="w-8 h-8" />, label: 'Coroa' },
  { id: 5, icon: <Music className="w-8 h-8" />, label: 'Disco' },
  { id: 6, icon: <Star className="w-8 h-8" />, label: 'Estrela' },
  { id: 7, icon: <Diamond className="w-8 h-8" />, label: 'Diamante' },
  { id: 8, icon: <Radio className="w-8 h-8" />, label: 'Produtora' },
];

export const MemoriaDaFama: React.FC = () => {
  const { user } = useTelegramUser();
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [score, setScore] = useState(0);
  const [errors, setErrors] = useState(0);
  const [myArtists, setMyArtists] = useState<Artist[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [isLoadingArtists, setIsLoadingArtists] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- LOAD ARTISTS ---
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;
      try {
        const artists = await api.meusArtistas(user.id);
        setMyArtists(artists);
        if (artists.length > 0) setSelectedArtist(artists[0]);
      } catch (err) {
        console.error('Error loading artists:', err);
      } finally {
        setIsLoadingArtists(false);
      }
    };
    loadData();
  }, [user?.id]);

  // --- INITIALIZE GAME ---
  const initGame = useCallback(async () => {
    if (!selectedArtist || !user?.id) {
      toast.error('Selecione um artista para jogar');
      return;
    }

    if (selectedArtist.saldo < ENTRY_FEE) {
      toast.error('Saldo insuficiente');
      return;
    }

    setGameState('SAVING'); // Loading state for entry fee sync

    try {
      // Deduct entry fee
      await api.syncGameCoins(
        user.id,
        ENTRY_FEE,
        0,
        'Memória da Fama (Inscrição)',
        selectedArtist.nome
      );

      const deck: Card[] = [];
      const shuffledIcons = [...ICON_POOL].sort(() => Math.random() - 0.5);
      
      shuffledIcons.forEach((item) => {
        deck.push({ id: Math.random(), pairId: item.id, icon: item.icon, label: item.label, isFlipped: false, isMatched: false });
        deck.push({ id: Math.random(), pairId: item.id, icon: item.icon, label: item.label, isFlipped: false, isMatched: false });
      });

      // Fisher-Yates
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }

      setCards(deck);
      setSelectedCards([]);
      setTimeLeft(GAME_DURATION);
      setMoves(0);
      setMatches(0);
      setScore(0);
      setErrors(0);
      setGameState('PLAYING');
    } catch (err) {
      toast.error('Erro ao iniciar partida');
      setGameState('MENU');
    }
  }, [selectedArtist, user?.id]);

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (gameState === 'PLAYING') {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setGameState('TIME_UP');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  // --- CARD CLICK HANDLER ---
  const handleCardClick = (index: number) => {
    if (gameState !== 'PLAYING' || cards[index].isFlipped || cards[index].isMatched || selectedCards.length === 2) return;

    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);

    const newSelected = [...selectedCards, index];
    setSelectedCards(newSelected);

    if (newSelected.length === 2) {
      const [first, second] = newSelected;
      setMoves((m) => m + 1);
      
      if (cards[first].pairId === cards[second].pairId) {
        setTimeout(() => {
          const matchedCards = [...cards];
          matchedCards[first].isMatched = true;
          matchedCards[second].isMatched = true;
          setCards(matchedCards);
          setMatches((prev) => {
            const next = prev + 1;
            if (next === 8) handleVictory();
            return next;
          });
          setSelectedCards([]);
        }, 500);
      } else {
        setErrors((e) => e + 1);
        setTimeout(() => {
          const resetCards = [...cards];
          resetCards[first].isFlipped = false;
          resetCards[second].isFlipped = false;
          setCards(resetCards);
          setSelectedCards([]);
        }, 1000);
      }
    }
  };

  // --- VICTORY HANDLER ---
  const handleVictory = () => {
    clearInterval(timerRef.current!);
    
    const timeBonus = timeLeft * 10;
    const precisionBonus = errors === 0 ? 500 : Math.max(0, 100 - errors * 10);
    const finalScore = timeBonus + precisionBonus;
    
    setScore(finalScore);
    
    confetti({
      articleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#c84bff', '#ffcc00', '#ffffff']
    });

    handleSaveResult(finalScore);
  };

  // --- SAVE RESULT ---
  const handleSaveResult = async (finalScore: number) => {
    setGameState('SAVING');
    if (!user?.id || !selectedArtist) return;

    const prizeMultiplier = timeLeft < 30 ? 3 : 1.5;
    const prize = ENTRY_FEE * prizeMultiplier;
    
    try {
      await api.syncGameCoins(
        user.id,
        0,
        prize,
        `Memória da Fama (Vitória: ${finalScore} pts)`,
        selectedArtist.nome
      );
      setGameState('VICTORY');
      toast.success(`Parabéns! Você ganhou ${prize} Coins!`);
    } catch (err) {
      console.error('Failed to save result:', err);
      setGameState('VICTORY');
    }
  };

  const getTimerColor = () => {
    if (timeLeft > 30) return 'bg-green-500';
    if (timeLeft > 10) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-[var(--game-bg)] flex flex-col items-center justify-center p-4 font-jakarta text-white overflow-hidden">
      
      {/* HEADER / HUD */}
      <div className="w-full max-w-md flex items-center justify-between mb-6 px-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black italic tracking-tighter bg-gradient-to-r from-[var(--game-primary)] to-[var(--game-accent)] bg-clip-text text-transparent uppercase">
            Memória da Fama
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Descubra Talentos Escondidos</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedArtist && (
             <div className="flex flex-col items-end">
                <span className="text-[9px] uppercase font-bold text-[var(--game-primary)]">Saldo {selectedArtist.nome}</span>
                <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                  <Coins className="w-3.5 h-3.5 text-[var(--game-accent)]" />
                  <span className="text-xs font-black tabular-nums">{selectedArtist.saldo.toLocaleString()}</span>
                </div>
             </div>
          )}
        </div>
      </div>

      {/* GAME AREA */}
      <div className="relative w-full max-w-md aspect-square bg-white/5 rounded-3xl p-4 border border-white/10 shadow-[0_0_80px_rgba(200,75,255,0.15)] overflow-visible">
        
        {/* PROGRESS BAR */}
        <div className="absolute -top-3 left-6 right-6 h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
          <motion.div 
            className={`h-full ${getTimerColor()} shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
            initial={{ width: '100%' }}
            animate={{ width: `${(timeLeft / GAME_DURATION) * 100}%` }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </div>

        {/* OVERLAYS */}
        <AnimatePresence>
          {gameState === 'MENU' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[var(--game-bg)]/80 backdrop-blur-md rounded-3xl p-8 text-center"
            >
              <div className="w-20 h-20 bg-gradient-to-br from-[var(--game-primary)] to-[var(--game-accent)] rounded-full flex items-center justify-center mb-6 shadow-2xl">
                <Trophy className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-black mb-2 italic uppercase">Speed Run</h2>
              <p className="text-white/60 text-sm mb-8">Encontre todos os pares em tempo recorde e multiplique seu investimento!</p>
              
              {!isLoadingArtists && myArtists.length > 0 ? (
                <div className="flex flex-col gap-6 w-full">
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] uppercase font-bold text-white/40">Selecione seu Artista</span>
                    <select 
                      value={selectedArtist?.nome}
                      onChange={(e) => setSelectedArtist(myArtists.find(a => a.nome === e.target.value) || null)}
                      className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-[var(--game-primary)]"
                    >
                      {myArtists.map(a => (
                        <option key={a.nome} value={a.nome} className="bg-[#1a0e2e]">{a.nome} (E$C {a.saldo})</option>
                      ))}
                    </select>
                  </div>

                  <button 
                    onClick={initGame}
                    className="w-full py-5 bg-[var(--game-primary)] hover:bg-[var(--game-primary)]/90 text-white font-black italic uppercase rounded-2xl transition-all shadow-[0_8px_0_#9a32c5] hover:translate-y-1 hover:shadow-[0_4px_0_#9a32c5] active:translate-y-2 active:shadow-none"
                  >
                    Jogar: {ENTRY_FEE} Coins
                  </button>
                  <div className="text-[10px] text-white/30 uppercase tracking-[0.2em]">Prêmio máx: 3x se finalizar &lt; 30s</div>
                </div>
              ) : !isLoadingArtists ? (
                <div className="flex flex-col items-center gap-4 py-6">
                  <AlertCircle className="w-12 h-12 text-yellow-500 opacity-50" />
                  <p className="text-sm text-white/50">Você precisa de um artista vinculado para jogar.</p>
                </div>
              ) : (
                <div className="py-12 animate-pulse text-white/30 uppercase font-black">Carregando Empire...</div>
              )}
            </motion.div>
          )}

          {(gameState === 'VICTORY' || gameState === 'TIME_UP' || gameState === 'SAVING') && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[var(--game-bg)]/90 backdrop-blur-xl rounded-3xl p-8 text-center"
            >
              <div className="mb-6">
                {gameState === 'VICTORY' ? (
                  <div className="relative">
                    <Trophy className="w-24 h-24 text-[var(--game-accent)] animate-bounce drop-shadow-[0_0_20px_rgba(255,204,0,0.5)]" />
                    {errors === 0 && (
                      <span className="absolute -top-4 -right-8 bg-red-600 text-[10px] font-black px-3 py-1.5 rounded-md rotate-12 shadow-2xl border border-red-400">FLAWLESS!</span>
                    )}
                  </div>
                ) : gameState === 'SAVING' ? (
                   <div className="w-20 h-20 border-4 border-[var(--game-primary)] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <History className="w-24 h-24 text-white/20" />
                )}
              </div>

              <h2 className="text-4xl font-black italic uppercase mb-2">
                {gameState === 'VICTORY' ? 'Pura Fama!' : gameState === 'SAVING' ? 'Processando' : 'Sessão Encerrada'}
              </h2>
              
              {gameState !== 'SAVING' && (
                <>
                  <div className="grid grid-cols-2 gap-4 w-full mb-8">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                      <div className="text-[10px] text-white/40 uppercase mb-1">Pontuação</div>
                      <div className="text-2xl font-black text-[var(--game-accent)] tabular-nums">{score}</div>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                      <div className="text-[10px] text-white/40 uppercase mb-1">Velocidade</div>
                      <div className="text-2xl font-black text-white tabular-nums">{GAME_DURATION - timeLeft}s</div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setGameState('MENU')}
                    className="w-full py-4 bg-white text-black font-black italic uppercase rounded-2xl transition-all shadow-[0_8px_0_#cccccc] hover:translate-y-1 hover:shadow-[0_4px_0_#cccccc] active:translate-y-2 active:shadow-none"
                  >
                    Voltar ao Menu
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* GRID */}
        <div className="grid grid-cols-4 grid-rows-4 gap-2.5 h-full relative z-10">
          {cards.map((card, idx) => (
            <div 
              key={card.id} 
              className="relative perspective-1000 group"
              onClick={() => handleCardClick(idx)}
            >
              <motion.div
                className="relative w-full h-full preserve-3d"
                animate={{ rotateY: card.isFlipped || card.isMatched ? 180 : 0 }}
                transition={{ duration: 0.5, type: 'spring', damping: 20, stiffness: 120 }}
              >
                {/* FRONT (HIDDEN) */}
                <div className={`absolute inset-0 backface-hidden rounded-xl bg-gradient-to-br from-[#1a0e2e] to-[#0d0221] border border-white/10 flex items-center justify-center cursor-pointer hover:border-[var(--game-primary)]/50 transition-all hover:scale-105 active:scale-95 group-hover:shadow-[0_0_15px_rgba(200,75,255,0.2)]`}>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                    <div className="w-1.5 h-1.5 bg-[var(--game-primary)] rounded-full animate-ping" />
                  </div>
                </div>

                {/* BACK (REVEALED) */}
                <div className={`absolute inset-0 backface-hidden rounded-xl rotate-y-180 flex flex-col items-center justify-center p-2 border-2 ${card.isMatched ? 'bg-[var(--game-accent)]/20 border-[var(--game-accent)] shadow-[0_0_30px_rgba(255,204,0,0.6),inset_0_0_15px_rgba(255,204,0,0.2)]' : 'bg-[var(--game-primary)]/15 border-[var(--game-primary)] shadow-[0_0_20px_rgba(200,75,255,0.4)]'}`}>
                  <div className={`transition-all duration-300 ${card.isMatched ? 'text-[var(--game-accent)] scale-110 drop-shadow-[0_0_8px_rgba(255,204,0,0.8)]' : 'text-white scale-100 drop-shadow-[0_0_8px_rgba(200,75,255,0.8)]'}`}>
                    {card.icon}
                  </div>
                  <span className={`text-[7px] uppercase mt-1 font-black leading-tight text-center ${card.isMatched ? 'text-[var(--game-accent)]/60' : 'text-white/40'}`}>
                    {card.label}
                  </span>
                </div>
              </motion.div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER HUD */}
      <div className="w-full max-w-md mt-8 grid grid-cols-3 gap-3">
        <div className="bg-white/5 p-3 rounded-2xl border border-white/5 flex flex-col items-center shadow-inner">
          <Timer className="w-3.5 h-3.5 mb-1 text-cyan-400" />
          <span className="text-xl font-black tabular-nums">{timeLeft}s</span>
          <span className="text-[9px] text-white/30 uppercase font-black tracking-wider">Tempo</span>
        </div>
        <div className="bg-white/5 p-3 rounded-2xl border border-white/5 flex flex-col items-center shadow-inner">
          <Target className="w-3.5 h-3.5 mb-1 text-emerald-400" />
          <span className="text-xl font-black tabular-nums">{matches}/8</span>
          <span className="text-[9px] text-white/30 uppercase font-black tracking-wider">Pares</span>
        </div>
        <div className="bg-white/5 p-3 rounded-2xl border border-white/5 flex flex-col items-center shadow-inner">
          <RotateCcw className="w-3.5 h-3.5 mb-1 text-orange-400" />
          <span className="text-xl font-black tabular-nums">{moves}</span>
          <span className="text-[9px] text-white/30 uppercase font-black tracking-wider">Lances</span>
        </div>
      </div>

      {/* CUSTOM CSS FOR 3D & PIXEL FEEL */}
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        
        select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 1rem center;
          background-size: 1.2rem;
        }
      `}</style>
    </div>
  );
};
