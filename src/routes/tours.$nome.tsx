import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { 
  ChevronLeft, 
  MapPin, 
  Ticket, 
  Users, 
  TrendingUp, 
  Calendar,
  Star,
  CheckCircle2,
  Mic2,
  Globe,
  Loader2,
  Trophy,
  Crown
} from "lucide-react";
import { api, type Artist, fmtEC, driveImg } from "@/lib/api";

export const Route = createFileRoute("/tours/$nome")({
  component: TourDetails,
});

function TourDetails() {
  const { nome } = Route.useParams();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [tourDetails, setTourDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.listarTodos(),
      api.listTours(),
      api.getAgendaTour(nome)
    ]).then(([artists, toursList, agendaData]) => {
      const art = artists.find(a => a.nome === nome);
      setArtist(art || null);

      const tFromList = toursList.find(t => t.artista === nome);
      
      if (tFromList) {
        const agenda = Array.isArray(agendaData) ? agendaData : [];
        setTourDetails({
          titulo: tFromList.titulo || "The Empire Tour",
          tipo: tFromList.porte || "Arena",
          status: tFromList.status || "Em andamento",
          qtd: Number(tFromList.total_shows || 0),
          shows_realizados: Number(tFromList.show_atual || 0),
          local_atual: tFromList.local_atual || "Mundial",
          arrecadacao_total: Number(tFromList.arrecadacao_total || 0),
          agenda: agenda,
          foto: tFromList.foto || ""
        });
      } else if (art && art.tour_info) {
        let info: any = art.tour_info;
        if (typeof info === "string") {
          try {
            const cleanJson = info.trim().replace(/^"+|"+$/g, "");
            info = JSON.parse(cleanJson);
          } catch { info = {}; }
        }
        setTourDetails({
          titulo: info.titulo || "The Empire Tour",
          tipo: info.tipo || "Arena",
          status: info.status || "Em andamento",
          qtd: Number(info.qtd || 10),
          shows_realizados: Number(info.shows_realizados || 0),
          local_atual: info.continente || "Mundial",
          arrecadacao_total: 0,
          agenda: []
        });
      }
      setLoading(false);
    });
  }, [nome]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh]">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sincronizando Rota...</p>
      </div>
    );
  }

  if (!artist || !tourDetails) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] p-8 text-center">
        <Mic2 className="size-16 text-muted-foreground/20 mb-4" />
        <h2 className="text-xl font-black uppercase italic italic tracking-tighter">Turnê não encontrada</h2>
        <p className="text-sm text-muted-foreground mt-2 mb-8 max-w-[240px]">Este artista não está em turnê no momento.</p>
        <Link to="/tours/" className="px-8 py-4 rounded-3xl bg-primary text-primary-foreground font-black uppercase text-xs tracking-widest">
           Ver todas as turnês
        </Link>
      </div>
    );
  }

  const info = tourDetails;
  const progress = info.qtd > 0 ? (info.shows_realizados / info.qtd) * 100 : 0;
  
  // Total de público somado da agenda
  const publicoTotal = Array.isArray(info.agenda) 
    ? info.agenda.reduce((acc: number, s: any) => acc + (Number(s.vendidos) || 0), 0)
    : 0;

  // Calculando Sold Outs a partir da agenda
  const soldOutsCount = Array.isArray(info.agenda)
    ? info.agenda.filter((s: any) => Number(s.vendidos) >= Number(s.capacidade) * 0.98).length
    : 0;

  const handleEditPhoto = async () => {
    const url = prompt("Insira o link direto da imagem (Google Drive):", info.foto || "");
    if (url === null) return;
    
    setSaving(true);
    try {
      const res = await api.vincularImagemTour(nome, url);
      if (res.ok) {
        setTourDetails((prev: any) => ({ ...prev, foto: url }));
        alert(res.message);
      } else {
        alert("Erro: " + res.erro);
      }
    } catch (e) {
      alert("Erro ao salvar imagem.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex-1 pb-24 bg-background">
      {/* Header Visual */}
      <div className="relative h-[45vh] min-h-[360px] overflow-hidden">
        {info.foto ? (
          <img 
            src={driveImg(info.foto, 800)} 
            className="w-full h-full object-cover object-top scale-105 blur-[2px] opacity-40 bg-black" 
            alt="" 
          />
        ) : (
          <div className="w-full h-full bg-black flex items-center justify-center opacity-30">
            <Crown className="size-40 text-primary" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        
        <Link 
          to="/tours/" 
          className="absolute top-6 left-6 z-30 size-12 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl active:scale-90 transition-transform"
        >
          <ChevronLeft className="size-6" />
        </Link>

        {/* Info Overlay */}
        <div className="absolute inset-x-6 bottom-12 z-20">
          <div className="flex flex-col items-center text-center">
            <button 
              onClick={handleEditPhoto}
              disabled={saving}
              className="size-20 rounded-[2.5rem] overflow-hidden border-2 border-primary/30 shadow-2xl mb-4 rotate-[-3deg] active:scale-95 transition-transform bg-black relative group"
            >
               {info.foto ? (
                 <img src={driveImg(info.foto, 400)} className="w-full h-full object-cover object-top" alt={artist.nome} />
               ) : (
                 <Crown className="size-10 m-auto text-primary" />
               )}
               <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                 <span className="text-[8px] font-black uppercase text-white tabular-nums">Editar</span>
               </div>
            </button>
            <div className="flex items-center gap-2 mb-2">
               <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-[8px] font-black uppercase tracking-widest border border-primary/20">
                  {info.tipo}
               </span>
               <span className="text-[10px] font-black text-white/40 uppercase tracking-widest italic">{artist.nome}</span>
            </div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none mb-2 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
               {info.titulo}
            </h1>
            
            {/* Revenue Badge - Top Center Focus */}
            <div className="mt-4 px-6 py-3 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-xl flex flex-col items-center">
               <span className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-500/60 mb-1">Arrecadação Total</span>
               <span className="text-2xl font-black italic tracking-tighter text-emerald-400">{fmtEC(info.arrecadacao_total)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-6 relative z-30 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
           <StatMini icon={<Users className="size-4" />} value={publicoTotal.toLocaleString()} label="Fans" />
           <StatMini icon={<Star className="size-4" />} value={soldOutsCount} label="Sold Outs" />
           <StatMini icon={<Calendar className="size-4" />} value={`${info.shows_realizados}/${info.qtd}`} label="Shows" />
        </div>

        {/* Progress Card */}
        <div className="p-6 rounded-[2.5rem] bg-card border border-white/5 relative overflow-hidden group">
           <div className="flex justify-between items-end mb-4 relative z-10">
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Progresso Executado</p>
                 <h4 className="text-2xl font-black italic tracking-tighter uppercase">{info.status}</h4>
              </div>
              <span className="text-3xl font-black italic text-primary">{Math.round(progress)}%</span>
           </div>
           <div className="h-4 bg-white/5 rounded-full overflow-hidden p-1 border border-white/5 relative z-10">
              <div 
                className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                style={{ width: `${progress}%` }}
              />
           </div>
           <Crown className="absolute -right-4 -bottom-4 size-32 opacity-5 rotate-12 group-hover:scale-110 transition-transform duration-700" />
        </div>

        {/* Agenda Section */}
        <section>
          <div className="flex items-center justify-between mb-5 px-1">
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Itinerário de Shows</h3>
             <div className="flex items-center gap-1.5 text-[9px] font-black text-primary uppercase">
                <Globe className="size-3" /> {info.local_atual || "EM ROTA MUNDIAL"}
             </div>
          </div>

          <div className="space-y-3">
             {Array.isArray(info.agenda) && info.agenda.length > 0 ? (
               info.agenda.map((s: any, i: number) => {
                  const isPast = i < info.shows_realizados;
                  const isCurrent = i === info.shows_realizados;
                  return (
                    <div 
                      key={i}
                      className={`flex items-center gap-4 p-4 rounded-3xl border transition-all ${
                        isCurrent 
                          ? "bg-primary/10 border-primary/30 ring-1 ring-primary/10" 
                          : isPast 
                            ? "bg-white/[0.01] border-white/5 opacity-50" 
                            : "bg-card border-white/5"
                      }`}
                    >
                      <div className={`size-14 rounded-2xl flex flex-col items-center justify-center shrink-0 border ${
                        isCurrent ? "bg-primary border-primary text-primary-foreground" : "bg-white/5 border-white/5 text-muted-foreground"
                      }`}>
                         <span className="text-[8px] font-black uppercase -mb-0.5 opacity-60">MAI</span>
                         <span className="text-xl font-black tracking-tighter leading-none">{s.data?.split('/')[0] || i + 1}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                         <h5 className={`font-black text-sm uppercase tracking-tight truncate ${isCurrent ? "text-white" : "text-foreground"}`}>
                           {s.local || "Cidade do Império"}
                         </h5>
                         <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                               <MapPin className="size-2.5 text-primary" /> The Empire {info.tipo}
                            </span>
                         </div>
                      </div>

                      <div className="text-right shrink-0">
                         {isPast ? (
                            <CheckCircle2 className="size-5 text-emerald-500" />
                         ) : s.vendidos >= s.capacidade * 0.98 ? (
                            <div className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[8px] font-black uppercase rounded-lg">SOLD OUT</div>
                         ) : (
                            <div className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-tighter">
                               {Math.round((s.vendidos / s.capacidade) * 100)}% Vend.
                            </div>
                         )}
                      </div>
                    </div>
                  );
               })
             ) : (
               <div className="py-20 text-center bg-card rounded-[2.5rem] border border-dashed border-white/5">
                  <Mic2 className="size-10 text-muted-foreground/10 mx-auto mb-3" />
                  <p className="text-xs text-muted-foreground italic">Carregando agenda detalhada...</p>
               </div>
             )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatMini({ icon, value, label }: any) {
  return (
    <div className="flex-1 p-3 rounded-2xl bg-card border border-white/5 flex flex-col items-center text-center">
       <div className="size-7 rounded-lg bg-white/5 grid place-items-center mb-1.5 text-primary">
          {icon}
       </div>
       <span className="text-base font-black tracking-tight leading-none mb-0.5">{value}</span>
       <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">{label}</span>
    </div>
  );
}
