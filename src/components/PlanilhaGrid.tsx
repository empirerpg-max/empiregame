import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { notify } from "@/lib/notify";

interface LinhaData {
  linha: number;
  artista: string;
  valores: Record<string, any>;
}

interface GridData {
  colunas?: string[];
  editaveis?: string[];
  linhas?: LinhaData[];
  erro?: string;
}

interface PlanilhaGridProps {
  tgId: string;
  loader: (tgId: string) => Promise<GridData>;
  saver: (p: { tgId: string; linha: number; coluna: string; valor: any }) => Promise<any>;
}

export function PlanilhaGrid({ tgId, loader, saver }: PlanilhaGridProps) {
  const [data, setData] = useState<GridData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!tgId) return;
    setLoading(true);
    loader(tgId)
      .then((r) => {
        if (r?.erro) setErro(r.erro);
        else setData(r);
      })
      .catch((e) => setErro("Erro: " + String(e.message || e)))
      .finally(() => setLoading(false));
  }, [tgId]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
        <Loader2 className="animate-spin w-5 h-5" />
        <span className="text-sm">Carregando planilha...</span>
      </div>
    );

  if (erro)
    return (
      <div className="p-4 text-center text-red-400 text-sm rounded-2xl bg-red-900/20 border border-red-500/20">
        {erro}
      </div>
    );

  if (!data?.linhas || data.linhas.length === 0)
    return (
      <div className="p-4 text-center text-muted-foreground text-sm rounded-2xl bg-white/5 border border-white/10">
        Nenhuma linha encontrada para o seu usuário.
      </div>
    );

  const colunas = data.colunas || [];
  const editaveis = new Set<string>(data.editaveis || []);

  async function handleEdit(linha: number, coluna: string, valor: any, original: any) {
    if (String(valor) === String(original ?? "")) return;
    const cellKey = `${linha}-${coluna}`;
    setSaving(cellKey);
    const r = await saver({ tgId, linha, coluna, valor });
    setSaving(null);
    if (r?.erro || r?.ok === false) {
      notify(r);
      setLoading(true);
      const fresh = await loader(tgId);
      setData(fresh);
      setLoading(false);
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
          {data.linhas.map((row) => (
            <tr key={row.linha} className="border-t border-white/5 hover:bg-white/[0.03]">
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
