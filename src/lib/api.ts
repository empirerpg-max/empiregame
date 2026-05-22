// src/lib/api.ts
export const api = {
  call: async (params: Record<string, any>) => {
    const gasUrl = import.meta.env.VITE_GAS_URL || "";
    const url = new URL(gasUrl);
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) url.searchParams.append(key, String(val));
    });
    const res = await fetch(url.toString());
    return await res.json();
  },

  // Helpers específicos do módulo PONTO
  getJogador: async (tgId: string) => {
    return api.call({ acao: "ponto_get_jogador", tgId });
  },

  distribuirPontosAleatorio: async (tgId: string) => {
    return api.call({ acao: "ponto_distribuir_aleatorio", tgId });
  },
};
