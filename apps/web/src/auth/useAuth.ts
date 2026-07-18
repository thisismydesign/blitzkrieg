import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthState {
  session: Session | null;
  user: User | null;
  /** True until the initial session lookup resolves. */
  loading: boolean;
}

export const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
