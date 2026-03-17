import { useState, useCallback, useRef } from 'react';

interface HistoryState {
  svgCode: string;
  timestamp: number;
}

interface UseHistoryReturn {
  pushState: (currentState: HistoryState) => void;
  undo: (currentState: HistoryState) => HistoryState | null;
  redo: (currentState: HistoryState) => HistoryState | null;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
}

const MAX_HISTORY = 50;

export function useHistory(): UseHistoryReturn {
  const pastRef = useRef<HistoryState[]>([]);
  const futureRef = useRef<HistoryState[]>([]);
  // Trigger re-renders when stack sizes change
  const [, setVersion] = useState(0);
  const bump = () => setVersion(v => v + 1);

  const pushState = useCallback((currentState: HistoryState) => {
    pastRef.current = [...pastRef.current, currentState].slice(-MAX_HISTORY);
    futureRef.current = [];
    bump();
  }, []);

  const undo = useCallback((currentState: HistoryState): HistoryState | null => {
    if (pastRef.current.length === 0) return null;
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, currentState];
    bump();
    return previous;
  }, []);

  const redo = useCallback((currentState: HistoryState): HistoryState | null => {
    if (futureRef.current.length === 0) return null;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, currentState].slice(-MAX_HISTORY);
    bump();
    return next;
  }, []);

  const clear = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    bump();
  }, []);

  return {
    pushState,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    clear,
  };
}
