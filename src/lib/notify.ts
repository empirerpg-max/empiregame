import { toast } from "sonner";

/**
 * Mostra o resultado de uma ação do Apps Script como toast bonito.
 * Compatível com Sonner v2 (API estável: toast, toast.error, toast.warning, toast.success).
 */
export function notify(result: unknown, opts: { successFallback?: string } = {}) {
  let msg = "";
  if (typeof result === "string") {
    msg = result;
  } else if (result && typeof result === "object") {
    const res = result as Record<string, unknown>;
    if (res.erro)          msg = "\u274C " + String(res.erro);
    else if (res.message)  msg = String(res.message);
    else if (res.msg)      msg = String(res.msg);
    else if (res.ok === true)  msg = "\u2705 " + (opts.successFallback || "Feito!");
    else if (res.ok === false) msg = "\u274C " + (String(res.msg) || "Falhou.");
    else msg = opts.successFallback || "Feito!";
  }

  // limpa IDs longos (UUIDs) que possam vazar para o usuário
  const clean = msg.replace(/\b[a-f0-9]{8}\b/gi, "").trim();

  const lines       = clean.split(/\n+/).filter(Boolean);
  const title       = lines[0] || "Feito";
  const description = lines.slice(1).join("\n") || undefined;

  // Sonner v2: toast.error / toast.warning / toast.success / toast() — API estável
  if (title.startsWith("\u274C")) {
    toast.error(title.replace(/^\u274C\s*/, ""), { description });
  } else if (title.startsWith("\u26A0\uFE0F")) {
    toast.warning(title.replace(/^\u26A0\uFE0F\s*/, ""), { description });
  } else if (title.startsWith("\u2705")) {
    toast.success(title.replace(/^\u2705\s*/, ""), { description });
  } else {
    toast(title, { description });
  }

  return { ok: title.startsWith("\u2705"), title, description };
}
