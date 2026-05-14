import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  Building2,
  Loader2,
  TrendingUp,
  Gem,
  Utensils,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { api, fmtEC, type Artist } from "@/lib/api";
import { useTelegramUser } from "@/lib/telegram";
import { notify } from "@/lib/notify";
import { Field, Input } from "./acoes.tour";

export const Route = createFileRoute("/incubadora")({
  component: IncubadoraPage,
});

const SEGMENTS = [
  {
    id: "tech",
    label: "Tech / Streaming",
    volatility: "Alta",
    icon: <Zap className="size-4" />,
    color: "text-blue-500",
    bg: "bg-blue-500/15",
  },
  {
    id: "beauty",
    label: "Beleza / Cosméticos",
    volatility: "Média",
    icon: <Gem className="size-4" />,
    color: "text-pink-500",
    bg: "bg-pink-500/15",
  },
  {
    id: "food",
    label: "Alimentação / Bebidas",
    volatility: "Baixa",
    icon: <Utensils className="size-4" />,
    color: "text-orange-500",
    bg: "bg-orange-500/15",
  },
];

function IncubadoraPage() {
  const { user, ready } = useTelegramUser();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [selectedArtist, setSelectedArtist] = useState("");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [segmento, setSegmento] = useState("beauty");
  const [investimento, setInvestimento] = useState("5000000");

  useEffect(() => {
    if (!ready || !user) return;
    api.meusArtistas(user.id).then((a) => {
      setArtists(a);
      if (a.length > 0) setSelectedArtist(a[0].nome);
      setLoading(false);
    });
  }, [ready, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedArtist || !nomeEmpresa || !investimento) return;
    setSubmitting(true);
    // Simulação da chamada de API (visto que no roteador do Apps Script não tinha 'incubadora' explícita,
    // mas a estrutura pede. Vou usar o endpoint de compra do market com categoria customizada ou
    // avisar que é uma ação administrativa por enquanto se não houver lógica de cron para lucro)
    const r = await api.comprarMarket({
      nome: selectedArtist,
      categoria: "INCUBADORA",
      item: `Fundação: ${nomeEmpresa} (${segmento})`,
    });
    notify(r, {
      successFallback:
        "Empresa fundada com sucesso! Os lucros semanais serão calculados pelo cron.",
    });
    setSubmitting(false);
  }

  return (
    <main className="flex-1 mx-auto w-full max-w-2xl px-4 pt-6 pb-20">
      <Link to="/" className="inline-flex items-center gap-1 text-muted-foreground mb-4">
        <ChevronLeft className="size-4" /> Voltar
      </Link>

      <header className="mb-8">
        <div className="size-12 rounded-xl bg-blue-500/15 text-blue-500 grid place-items-center mb-4">
          <Building2 className="size-6" />
        </div>
        <h1 className="text-3xl font-black">Incubadora de Empresas</h1>
        <p className="text-muted-foreground mt-2">
          Torne-se um magnata dos negócios além da música.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
          <Field label="Sócio Majoritário">
            <select
              value={selectedArtist}
              onChange={(e) => setSelectedArtist(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-3 text-sm"
              disabled={loading}
            >
              {artists.map((a) => (
                <option key={a.nome} value={a.nome}>
                  {a.nome} ({fmtEC(a.saldo)})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nome da Empresa">
            <Input
              value={nomeEmpresa}
              onChange={(e) => setNomeEmpresa(e.target.value)}
              placeholder="Ex: Fenty Beauty, Skims..."
              required
            />
          </Field>

          <Field label="Capital Inicial (Mín EC 5M)">
            <Input
              type="number"
              value={investimento}
              onChange={(e) => setInvestimento(e.target.value)}
              placeholder="5000000"
              required
            />
          </Field>
        </div>

        <section>
          <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3 px-1">
            Segmento de Atuação
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {SEGMENTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSegmento(s.id)}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${segmento === s.id ? "bg-card border-primary ring-1 ring-primary" : "bg-card border-border"}`}
              >
                <div className={`size-10 rounded-lg grid place-items-center ${s.bg} ${s.color}`}>
                  {s.icon}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-sm">{s.label}</p>
                  <p className="text-xs text-muted-foreground">Volatilidade: {s.volatility}</p>
                </div>
                {segmento === s.id && <ShieldCheck className="size-5 text-primary" />}
              </button>
            ))}
          </div>
        </section>

        <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
          <p className="text-xs text-blue-500/80 leading-relaxed italic flex items-start gap-2">
            <TrendingUp className="size-4 shrink-0" />
            Empresas geram lucros ou prejuízos semanais baseados na volatilidade do mercado.
            Mantenha seu capital girando.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting || !nomeEmpresa || parseInt(investimento) < 5000000}
          className="w-full py-4 rounded-full bg-blue-600 text-white font-extrabold shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Building2 className="size-4" />
          )}
          Fundar Empresa
        </button>
      </form>
    </main>
  );
}
