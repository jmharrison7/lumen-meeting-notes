import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ActionItem } from "./types";

type Overrides = Record<string, Partial<ActionItem>>;

interface UiState {
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  toggleTheme: () => void;
  reviewed: Record<string, boolean>;
  setReviewed: (noteId: string, value: boolean) => void;
  overrides: Overrides;
  patchItem: (id: string, patch: Partial<ActionItem>) => void;
  applyItem: (item: ActionItem) => ActionItem;
  hiddenNotes: string[];
  hideNotes: (ids: string[]) => void;
}

const Ctx = createContext<UiState | null>(null);

const KEY = "lumen.ui.v1";

interface Persisted {
  theme?: "light" | "dark";
  reviewed?: Record<string, boolean>;
  overrides?: Overrides;
  hiddenNotes?: string[];
}

function read(): Persisted {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Persisted;
  } catch {
    return {};
  }
}

export function UiStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = read();
    setState(loaded);
    setHydrated(true);
  }, []);

  const theme = state.theme ?? "light";

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const setTheme = useCallback((t: "light" | "dark") => setState((s) => ({ ...s, theme: t })), []);
  const toggleTheme = useCallback(
    () => setState((s) => ({ ...s, theme: (s.theme ?? "light") === "light" ? "dark" : "light" })),
    [],
  );
  const setReviewed = useCallback(
    (noteId: string, value: boolean) =>
      setState((s) => ({ ...s, reviewed: { ...(s.reviewed ?? {}), [noteId]: value } })),
    [],
  );
  const patchItem = useCallback(
    (id: string, patch: Partial<ActionItem>) =>
      setState((s) => ({
        ...s,
        overrides: { ...(s.overrides ?? {}), [id]: { ...(s.overrides ?? {})[id], ...patch } },
      })),
    [],
  );
  const hideNotes = useCallback(
    (ids: string[]) =>
      setState((s) => ({ ...s, hiddenNotes: [...new Set([...(s.hiddenNotes ?? []), ...ids])] })),
    [],
  );

  const overrides = useMemo(() => state.overrides ?? {}, [state.overrides]);

  const value = useMemo<UiState>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      reviewed: state.reviewed ?? {},
      setReviewed,
      overrides,
      patchItem,
      applyItem: (item) => ({ ...item, ...(overrides[item.id] ?? {}) }),
      hiddenNotes: state.hiddenNotes ?? [],
      hideNotes,
    }),
    [theme, setTheme, toggleTheme, state.reviewed, setReviewed, overrides, patchItem, state.hiddenNotes, hideNotes],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUi() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUi must be used inside UiStateProvider");
  return ctx;
}
