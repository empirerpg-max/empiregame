// src/lib/api.ts
export const api = {
  // Esta função unifica todas as chamadas para o Google Apps Script
  call: async (params: Record<string, any>) => {
    const gasUrl = import.meta.env.VITE_GAS_URL || import.meta.env.VITE_APJ_URL || "";
    if (!gasUrl) throw new Error("URL do Google Apps Script não configurada.");

    const url = new URL(gasUrl);
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) url.searchParams.append(key, String(val));
    });

    const response = await fetch(url.toString());
    return await response.json();
  },
};
