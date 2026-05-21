import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTelegramUser } from "@/lib/telegram";
import { notify } from "@/lib/notify";

interface PlanilhaData {
  colunas?: string[];
  editaveis?: string[];
  linhas?: Array<{ linha: number; artista: string; valores: Record<string, any> }>;
  erro?: string;
}

interface Props {
  loader: (tgId: string) => Promise<PlanilhaData>;
  saver: (p: { tgId: string; linha: number; coluna: string; valor: any }) => Promise<{ ok?: boolean; erro?: string; message?: string }>;
}

export function PlanilhaGrid({ loader, saver }: Props) {
  const { user, ready } = useTelegramUser();
  const [data, setData] = useState<PlanilhaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !user?.id) {
      setLoading(false);
      return;
    }
    loader(String(user.id)).then((r) => {
      setData(r);
      setLoading(false);
    });
  }, [user, ready]);

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user?.id) return <p className="text-sm text-muted-foreground">Abra o app pelo Telegram.</p>;
  if (data?.erro) return <p className="text-sm text-destructive">{data.erro}</p>;
  if (!data?.linhas || data.linhas.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma linha pra você nessa planilha.</p>;
  }

  const colunas = data.colunas || [];
  const editaveis = new Set(data.editaveis || []);

  async function handleEdit(linha: number, coluna: string, valor: any, original: any) {
    if (String(valor) === String(original ?? "")) return;
    const cellKey = `${linha}-${coluna}`;
    setSaving(cellKey);
    const r = await saver({ tgId: String(user!.id), linha, coluna, valor });
    setSaving(null);
    if (r?.erro || r?.ok === false) {
      notify(r);
      // reverte: recarrega
      if (user?.id) {
        const fresh = await loader(String(user.id));
        setData(fresh);
      }
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-card">
      <table className="min-w-full text-xs">
        <thead className="bg-white/5 sticky top-0">
          <tr>
            {colunas.map((c) => (
              <th
                key={c}
                className={`px-3 py-2 text-left font-black uppercase tracking-widest text-[10px] whitespace-nowrap ${
                  editaveis.has(c) ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {c}
                {editaveis.has(c) && <span className="ml-1 text-primary/60">•</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.linhas.map((row) => (
            <tr key={row.linha} className="border-t border-white/5 hover:bg-white/[0.02]">
              {colunas.map((c) => {
                const cellKey = `${row.linha}-${c}`;
                const val = row.valores[c];
                if (editaveis.has(c)) {
                  return (
                    <td key={c} className="px-2 py-1">
                      <CellInput
                        initial={val ?? ""}
                        onSave={(v) => handleEdit(row.linha, c, v, val)}
                        saving={saving === cellKey}
                      />
                    </td>
                  );
                }
                return (
                  <td key={c} className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {val ?? ""}
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

function CellInput({
  initial,
  onSave,
  saving,
}: {
  initial: any;
  onSave: (v: string) => void;
  saving: boolean;
}) {
  const [val, setVal] = useState(String(initial ?? ""));
  useEffect(() => setVal(String(initial ?? "")), [initial]);
  return (
    <div className="relative">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => onSave(val)}
        className="w-full bg-background/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
      />
      {saving && (
        <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 animate-spin text-primary" />
      )}
    </div>
  );
}
