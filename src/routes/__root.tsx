import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  Scripts,
  useLocation,
} from "@tanstack/react-router";
import { 
  Home, 
  Crown, 
  Library, 
  Radio, 
  Disc3, 
  ListMusic, 
  ShoppingBag, 
  Star, 
  Mic2, 
  Menu, 
  X, 
  User, 
  Building2, 
  Dice5, 
  Gamepad2,
  ChevronDown,
  Gavel,
  Swords,
  HandHeart,
  TrendingUp,
  Search,
  HelpCircle,
  Share2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { useTelegramUser } from "@/lib/telegram";
import { api, driveImg, type Artist } from "@/lib/api";

function GlobalLinkModal({ onClose }: { onClose: () => void }) {
  const { user } = useTelegramUser();
  const [available, setAvailable] = useState<Artist[]>([]);
  const [q, setQ] = useState("");
  const [linking, setLinking] = useState<string | null>(null);

  useEffect(() => {
    api.getArtistasSemId().then(setAvailable);
  }, []);

  const filtered = available.filter(a => a.nome.toLowerCase().includes(q.toLowerCase()));

  const handleLink = async (nome: string) => {
    if (!user || user.id === "guest") return;
    setLinking(nome);
    try {
      const res = await api.vincularArtista(nome, user.id);
      if (res.ok) {
        toast.success("Vínculo estabelecido!", { description: `${nome} agora faz parte do seu império.` });
        setAvailable(prev => prev.filter(x => x.nome !== nome));
        onClose();
      } else {
        toast.error(res.erro || "Falha ao vincular");
      }
    } catch (e) {
      toast.error("Erro na conexão");
    } finally {
      setLinking(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
       <motion.div 
         initial={{ y: 20, opacity: 0 }}
         animate={{ y: 0, opacity: 1 }}
         className="w-full max-w-sm bg-card border border-white/10 rounded-[3rem] p-6 shadow-2xl relative max-h-[80vh] flex flex-col"
       >
          <button onClick={onClose} className="absolute top-4 right-4 p-2 opacity-50 hover:opacity-100"><X className="size-5" /></button>
          
          <h3 className="text-lg font-black tracking-tighter mb-1 text-center decoration-primary decoration-2 underline underline-offset-2">Vincular Artista</h3>
          <p className="text-[8px] text-muted-foreground uppercase font-black tracking-widest text-center mb-4 opacity-60">Assine contrato com uma lenda disponível</p>
          
          <div className="relative mb-4">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
             <input 
               value={q}
               onChange={e => setQ(e.target.value)}
               placeholder="Buscar artista..."
               className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 text-sm font-bold uppercase tracking-tighter"
             />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide py-2">
             {filtered.map(a => (
               <div key={a.nome} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5 group hover:bg-white/[0.06] transition-colors">
                  <div className="size-10 rounded-xl bg-primary/10 grid place-items-center font-black text-primary text-xs flex-shrink-0">{a.nome[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-xs truncate uppercase tracking-tight">{a.nome}</p>
                    <p className="text-[8px] text-muted-foreground uppercase font-black opacity-40">{a.gravadora}</p>
                  </div>
                  <button 
                    disabled={!!linking}
                    onClick={() => handleLink(a.nome)}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                  >
                    {linking === a.nome ? "..." : "Vincular"}
                  </button>
               </div>
             ))}
             {available.length === 0 && <div className="text-center py-10 opacity-20"><Library className="size-10 mx-auto mb-2" /><p className="text-[10px] font-black uppercase">Nenhum artista vago</p></div>}
          </div>
       </motion.div>
    </div>
  );
}

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#000000" },
      { title: "Empire Hub" },
      {
        name: "description",
        content: "Gerencie seus artistas, suba nos charts e construa um império musical.",
      },
      { name: "author", content: "Empire RPG" },
      { property: "og:title", content: "Empire Hub" },
      {
        property: "og:description",
        content: "Gerencie seus artistas, suba nos charts e construa um império musical.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Empire Hub" },
      {
        name: "twitter:description",
        content: "Gerencie seus artistas, suba nos charts e construa um império musical.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/130c3ca4-e5a2-42b6-b630-b40d622d345c/id-preview-b6ad8193--6634bb87-7b09-47bf-82c3-5047e8bc7caa.lovable.app-1777495380913.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/130c3ca4-e5a2-42b6-b630-b40d622d345c/id-preview-b6ad8193--6634bb87-7b09-47bf-82c3-5047e8bc7caa.lovable.app-1777495380913.png",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
      },
    ],
    scripts: [{ src: "https://telegram.org/js/telegram-web-app.js" }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HeadContent />
      {children}
      <Scripts />
    </>
  );
}

function BottomNav() {
  const { pathname } = useLocation();
  const items = [
    { to: "/", label: "Hub", icon: Home },
    { to: "/artistas", search: { filter: "mine" }, label: "Artistas", icon: Library },
    { to: "/social", label: "Social", icon: Share2 },
    { to: "/ranking", label: "Rank", icon: Star },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-white/5 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto max-w-md flex items-center justify-around px-2 py-0.5 pb-[max(0.15rem,env(safe-area-inset-bottom))]">
        {items.map((it) => {
          const active = pathname === it.to || (it.to !== "/" && pathname.startsWith(it.to));
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              search={it.search}
              className={`flex flex-col items-center gap-0 px-3 py-1 transition-all ${
                active ? "text-primary opacity-100" : "text-muted-foreground opacity-60"
              }`}
            >
              <Icon
                className={`size-4.5 ${active ? "scale-105" : ""}`}
                strokeWidth={active ? 3 : 2}
              />
              <span className={`text-[7px] font-black uppercase tracking-tighter ${active ? 'visible' : 'visible'}`}>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function RootComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const [showIdModal, setShowIdModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [manualId, setManualId] = useState("");
  const { user, ready, setUserManually } = useTelegramUser();

  useEffect(() => {
    (window as any).setShowIdModal = setShowIdModal;
    (window as any).setShowLinkModal = setShowLinkModal;
  }, []);

  const handleManualIdSubmit = () => {
    if (!manualId.trim()) return;
    setUserManually(manualId.trim(), "Magnata");
    setShowIdModal(false);
    toast.success("ID Definido", { description: `Conectado como ${manualId}` });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background pb-24 pt-16">
      {/* Filtro SVG global */}
      <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
        <filter id="charcoal-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
        </filter>
      </svg>

      {/* Top Bar */}
      <nav className="fixed top-0 inset-x-0 z-[60] h-16 bg-background/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6">
         <Link to="/" className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-black italic tracking-tighter">E</div>
            <span className="font-black italic uppercase tracking-tighter text-base">Empire Hub</span>
         </Link>
         <button 
           onClick={() => setIsOpen(!isOpen)}
           className="p-2 -mr-2 text-foreground active:scale-95 transition-transform"
         >
           {isOpen ? <X className="size-6 text-primary" /> : <Menu className="size-6" />}
         </button>
      </nav>

      {/* Hamburger Overlay Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed inset-0 z-50 bg-background pt-20 px-6 overflow-y-auto"
          >
             <div className="space-y-4 pb-12">
                <MenuCategory 
                  title="Empire Studio" 
                  icon={Library}
                  items={[
                    { to: "/artistas", search: { filter: "all" }, label: "Empire Artists", icon: Library },
                    { to: "/incubadora", label: "Corporativo", icon: Building2 },
                    { to: "/albuns", label: "Discografia", icon: Disc3 },
                    { to: "/playlists", label: "Playlists", icon: ListMusic },
                  ]} 
                  onClose={() => setIsOpen(false)}
                />

                <MenuCategory 
                  title="Empire Market" 
                  icon={ShoppingBag}
                  items={[
                    { to: "/market", label: "Mercado Principal", icon: ShoppingBag },
                    { to: "/leiloes", label: "Leilões", icon: Gavel },
                    { to: "/bet", label: "Empire Bet", icon: Dice5 },
                  ]} 
                  onClose={() => setIsOpen(false)}
                />

                <MenuCategory 
                  title="Empire Coliseum" 
                  icon={Swords}
                  items={[
                    { to: "/ranking", label: "Rankings", icon: Star },
                    { to: "/charts", label: "Charts", icon: TrendingUp },
                    { to: "/duelo", label: "Duelos", icon: Swords },
                    { to: "/hall", label: "Hall of Fame", icon: Crown },
                  ]} 
                  onClose={() => setIsOpen(false)}
                />

                <MenuCategory 
                  title="Empire Extras" 
                  icon={Radio}
                  items={[
                    { to: "/social", label: "Empire Social", icon: Share2 },
                    { to: "/radar", label: "Radar Feed", icon: Radio },
                    { to: "/filantropia", label: "Filantropia", icon: HandHeart },
                    { to: "/games", label: "Jogos", icon: Gamepad2 },
                  ]} 
                  onClose={() => setIsOpen(false)}
                />
                
                <div className="pt-8 border-t border-white/5 space-y-3">
                   <Link
                     to="/tutorial"
                     onClick={() => setIsOpen(false)}
                     className="flex items-center gap-4 p-4 rounded-3xl bg-white/[0.02] border border-white/5 text-muted-foreground hover:text-foreground transition-all"
                   >
                      <HelpCircle className="size-5" />
                      <span className="font-black uppercase tracking-widest text-[10px]">Guia de Sobrevivência</span>
                   </Link>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modais Globais */}
      <AnimatePresence>
        {showIdModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-card border border-white/10 rounded-[3rem] p-8 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowIdModal(false)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 transition-colors"
              >
                <X className="size-5 text-muted-foreground" />
              </button>
              
              <div className="size-16 rounded-3xl bg-primary/10 grid place-items-center mb-6 mx-auto">
                <Crown className="size-8 text-primary" />
              </div>
              
              <h3 className="text-xl font-black tracking-tighter mb-2 text-center underline decoration-primary decoration-4 underline-offset-4">Identidade Imperial</h3>
              <p className="text-[9px] text-muted-foreground uppercase font-black tracking-[0.2em] text-center mb-6 px-4 opacity-70">Sincronize seu passaporte para acessar seus bens e artistas.</p>
              
              <div className="space-y-4">
                <div className="relative">
                  <input 
                    type="text"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    placeholder="DIGITE SEU ID TELEGRAM"
                    className="w-full h-20 bg-white/5 border-2 border-white/10 rounded-3xl px-6 font-black text-center text-xl outline-none focus:border-primary/50 transition-all placeholder:text-white/10"
                  />
                  {!manualId && <span className="absolute left-1/2 -translate-x-1/2 bottom-3 animate-pulse text-[8px] font-black text-primary uppercase">Obrigatório</span>}
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button 
                    onClick={() => setShowIdModal(false)} 
                    className="h-16 rounded-[2rem] bg-white/5 border border-white/10 font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all hover:bg-white/10"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={handleManualIdSubmit} 
                    className="h-16 rounded-[2rem] bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all shadow-[0_10px_30px_rgba(var(--primary-rgb),0.3)] shadow-primary/20"
                  >
                    Conectar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        
        {showLinkModal && (
          <GlobalLinkModal onClose={() => setShowLinkModal(false)} />
        )}
      </AnimatePresence>

      <Outlet />
      <BottomNav />
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}

function MenuCategory({ title, icon: Icon, items, onClose }: any) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="space-y-2">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 rounded-3xl bg-white/[0.02] border border-white/5 text-left group"
      >
        <div className="flex items-center gap-3">
           <div className="size-8 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <Icon className="size-4" />
           </div>
           <span className="font-black uppercase tracking-widest text-xs group-hover:text-primary transition-colors">{title}</span>
        </div>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="grid grid-cols-2 gap-2 px-1">
          {items.map((it: any, i: number) => (
            <Link
              key={i}
              to={it.to}
              search={it.search}
              onClick={onClose}
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-[2rem] bg-card border border-white/5 hover:border-primary/20 transition-all text-center group"
            >
              <div className="size-11 rounded-2xl bg-white/5 text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all grid place-items-center">
                <it.icon className="size-5" />
              </div>
              <span className="font-black uppercase tracking-widest text-[10px] text-muted-foreground/60 group-hover:text-foreground">{it.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
