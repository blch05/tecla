'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** Proveedores de la app. El cliente de TanStack Query se crea una vez por pestaña. */
export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    // sin Supabase configurado no tiene sentido reintentar
    defaultOptions: { queries: { staleTime: 15_000, retry: (n, err) => n < 1 && !/Falta conectar/.test(err.message) } },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
