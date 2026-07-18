import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { getAccounts, linkChesscom } from './account';
import { getGames, getUnanalyzedGames, importGames } from './games';
import { countDueReviews, getDueReviews } from './reviews';
import { analyzeGames, type AnalysisProgress } from '../drill/analysisRunner';

const enabledWhenSignedIn = (userId: string | undefined) => ({ enabled: Boolean(userId) });

export function useAccounts() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['accounts'], queryFn: getAccounts, ...enabledWhenSignedIn(user?.id) });
}

export function useGames() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['games'], queryFn: () => getGames(), ...enabledWhenSignedIn(user?.id) });
}

export function useDueCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dueCount'],
    queryFn: countDueReviews,
    ...enabledWhenSignedIn(user?.id),
  });
}

export function useDueReviews() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dueReviews'],
    queryFn: () => getDueReviews(),
    ...enabledWhenSignedIn(user?.id),
  });
}

export function useLinkChesscom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => linkChesscom(username),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { accountId: string; maxMonths?: number }) =>
      importGames(args.accountId, args.maxMonths),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['games'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/** Runs client-side Stockfish analysis over unanalysed games, exposing progress. */
export function useAnalyze() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);

  const mutation = useMutation({
    mutationFn: async (limit: number) => {
      if (!user) throw new Error('not signed in');
      const games = await getUnanalyzedGames(limit);
      return analyzeGames(games, user.id, setProgress);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['games'] });
      qc.invalidateQueries({ queryKey: ['dueCount'] });
      qc.invalidateQueries({ queryKey: ['dueReviews'] });
      setProgress(null);
    },
  });

  return { ...mutation, progress };
}
