import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Resolve URL — aceita tanto o nome gerado pelo Lovable quanto o nome manual
const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PROJECT_URL) ||
  (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  '';

// Resolve KEY — aceita PUBLISHABLE_KEY (Lovable) e ANON_KEY (Supabase CLI padrão)
const SUPABASE_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.SUPABASE_PUBLISHABLE_KEY) ||
  (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
  if (!SUPABASE_KEY) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY)');
  console.warn(
    `[Supabase] Variável(is) de ambiente ausente(s): ${missing.join(', ')}.\n` +
    `Adicione-as ao .env ou conecte o projeto ao Supabase no painel do Lovable.\n` +
    `Chamadas ao banco retornarão erro até que as variáveis sejam configuradas.`
  );
}

// Cria o cliente apenas se as variáveis existirem; caso contrário retorna um
// stub que loga o problema sem derrubar toda a aplicação.
function createSafeClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    // Stub que nunca lança — deixa a UI carregar e mostra mensagem de erro só
    // nos componentes que tentam usar o banco.
    return createClient<Database>(
      'https://placeholder.supabase.co',
      'placeholder-key'
    );
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

// Singleton lazy
let _supabase: ReturnType<typeof createSafeClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSafeClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSafeClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
