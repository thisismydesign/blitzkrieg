import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { getAccounts, linkChesscom } from './account';
import {
  countGames,
  countUnanalyzedGames,
  getGames,
  getUnanalyzedGames,
  importGames,
} from './games';
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

export function useGamesCount() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['gamesCount'], queryFn: countGames, ...enabledWhenSignedIn(user?.id) });
}

export function useUnanalyzedCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['unanalyzedCount'],
    queryFn: countUnanalyzedGames,
    ...enabledWhenSignedIn(user?.id),
  });
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

  const controllerRef = useRef<AbortController | null>(null);

  const mutation = useMutation({
    // Analyse ALL unanalysed games. Resumable: completed games are marked, so a
    // stop/refresh and re-run picks up where it left off.
    mutationFn: async () => {
      if (!user) throw new Error('not signed in');
      const controller = new AbortController();
      controllerRef.current = controller;
      const games = await getUnanalyzedGames();
      return analyzeGames(games, user.id, setProgress, { signal: controller.signal });
    },
    onSettled: () => {
      controllerRef.current = null;
      setProgress(null);
      qc.invalidateQueries({ queryKey: ['gamesCount'] });
      qc.invalidateQueries({ queryKey: ['unanalyzedCount'] });
      qc.invalidateQueries({ queryKey: ['games'] });
      qc.invalidateQueries({ queryKey: ['dueCount'] });
      qc.invalidateQueries({ queryKey: ['dueReviews'] });
    },
  });

  return { ...mutation, progress, stop: () => controllerRef.current?.abort() };
}
