import { useEffect, useState } from "react";
import { useTelegramUser } from "@/lib/telegram";
import { Loader2 } from "lucide-react";
import { notify } from "@/lib/notify";

interface PlanilhaGridProps {
  loader: (tgId: string) => Promise<{
    colunas?: string[];
    editaveis?: string[];
    linhas?: Array<{ linha: number; artista: string; valores: Record<string, any> }>;
    erro?: string;
  }>;
  saver: (p: { tgId: string; linha: number; coluna: string; valor: any }) => Promise<any>;
}

export function PlanilhaGrid({ loader, saver }: PlanilhaGridProps) {
  const { user, ready } = useTelegramUser();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro(null);
    loader(String(user.id))
      .then((r) => {
        if (r?.erro) setErro(r.erro);
        else setData(r);
      })
      .catch((e) => setErro("Erro ao carregar: " + e.message))
      .finally(() => setLoading(false));
  }, [ready, user?.id]);

  if (!ready || loading)
    return (
      <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
        <Loader2 className="animate-spin w-5 h-5" />
        <span className="text-sm">Carregando planilha...</span>
      </div>
    );

  if (!user?.id) return <div className="p-6 text-center text-muted-foreground text-sm">Abra o app pelo Telegram.</div>;

  if (erro) return <div className="p-6 text-center text-red-400 text-sm">{erro}</div>;

  if (!data?.linhas || data.linhas.length === 0)
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">Nenhuma linha encontrada para o seu usuário.</div>
    );

  const colunas: string[] = data.colunas || [];
  const editaveis = new Set<string>(data.editaveis || []);

  async function handleEdit(linha: number, coluna: string, valor: any, original: any) {
    if (String(valor) === String(original ?? "")) return;
    const cellKey = `${linha}-${coluna}`;
    setSaving(cellKey);
    const r = await saver({ tgId: String(user!.id), linha, coluna, valor });
    setSaving(null);
    if (r?.erro || r?.ok === false) {
      notify(r);
      // Reverte recarregando
      if (user?.id) {
        setLoading(true);
        const fresh = await loader(String(user.id));
        setData(fresh);
        setLoading(false);
      }
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="text-xs w-full">
        <thead>
          <tr className="bg-white/5">
            {colunas.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                {c} {editaveis.has(c) && <span className="text-primary">•</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.linhas.map((row: any) => (
            <tr key={row.linha} className="border-t border-white/5 hover:bg-white/3">
              {colunas.map((c) => {
                const cellKey = `${row.linha}-${c}`;
                const isEdit = editaveis.has(c);
                return (
                  <td key={c} className="px-3 py-2 whitespace-nowrap relative">
                    {isEdit ? (
                      <input
                        className="bg-transparent border-b border-primary/30 focus:border-primary outline-none w-full min-w-[80px] text-xs"
                        defaultValue={row.valores[c] ?? ""}
                        disabled={saving === cellKey}
                        onBlur={(e) => handleEdit(row.linha, c, e.target.value, row.valores[c])}
                      />
                    ) : (
                      <span className="text-muted-foreground">{String(row.valores[c] ?? "")}</span>
                    )}
                    {saving === cellKey && (
                      <Loader2 className="animate-spin w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 text-primary" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
