import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './AppShell';
import { AuthProvider } from './auth/AuthProvider';
import { queryClient } from './lib/queryClient';
import './index.css';
import './shell.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
