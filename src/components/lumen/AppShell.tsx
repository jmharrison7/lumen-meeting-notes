import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  BookUser,
  CalendarDays,
  CheckSquare,
  Circle,
  Command as CommandIcon,
  FileText,
  LayoutTemplate,
  Lightbulb,
  LogOut,
  Moon,
  Wallet,

  Search,
  Sun,
  Users,
  UserCog,
  X,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useUi } from "@/lib/ui-store";
import { getLiveSession, listNotes } from "@/lib/api";
import { useAccess } from "@/lib/access-store";
import { useAuth } from "@/lib/auth-store";
import { MobileTabBar } from "./MobileTabBar";
import { InstallHint } from "./InstallHint";

const nav = [
  { to: "/", label: "Today", icon: CalendarDays, exact: true },
  { to: "/notes", label: "All Notes", icon: FileText, exact: false },
  { to: "/actions", label: "Action Items", icon: CheckSquare, exact: false },
  { to: "/clients", label: "Clients", icon: Users, exact: false },
  { to: "/ideas", label: "Ideas", icon: Lightbulb, exact: false },
  { to: "/money", label: "Money", icon: Wallet, exact: false },
  { to: "/templates", label: "Templates", icon: LayoutTemplate, exact: false },
  { to: "/contacts", label: "Contacts", icon: BookUser, exact: false },
  { to: "/collaborators", label: "Collaborators", icon: UserCog, exact: false },
  { to: "/alerts", label: "Alerts", icon: Bell, exact: false },
  { to: "/search", label: "Search", icon: Search, exact: false },
] as const;

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useUi();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState("");
  useEffect(() => setToday(todayLabel()), []);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        const box = document.querySelector<HTMLInputElement>("[data-search-input]");
        if (box) box.focus();
        else void navigate({ to: "/search" });
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const { previewing, collaborators, previewAs, isOwner } = useAccess();
  const visibleNav = nav.filter(
    (n) => isOwner || !["/money", "/templates", "/alerts", "/collaborators", "/contacts"].includes(n.to),
  );

  const { data: notes } = useQuery({ queryKey: ["notes"], queryFn: listNotes });
  const { data: live } = useQuery({ queryKey: ["live"], queryFn: getLiveSession });

  return (
    <div className="flex min-h-screen bg-background">
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-[2px] md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 md:flex md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 pb-4 pt-6">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-title text-[22px] font-semibold">Lumen</span>
            <span className="size-1.5 rounded-full bg-ember" />
          </Link>
          <button
            className="rounded-md p-1 text-muted-foreground md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="px-5 pb-5 text-xs text-muted-foreground">{today || "\u00a0"}</p>

        <nav className="flex flex-col gap-0.5 px-3">
          {visibleNav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.exact }}
              className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-sidebar-foreground"
            >
              <n.icon className="size-4 opacity-70" />
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="px-3 pt-5">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-sidebar-border px-2.5 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-ember hover:text-foreground"
          >
            <Circle className="size-3 fill-ember text-ember" />
            Record a meeting
            <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] opacity-70">
              <CommandIcon className="size-2.5" />K
            </span>
          </button>
        </div>

        <div className="mt-auto space-y-3 border-t border-sidebar-border p-3">
          <InstallHint />
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <span className="grid size-7 place-items-center rounded-full bg-ember-soft text-[11px] font-semibold text-ember">
              M
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{previewing?.name ?? previewing?.email ?? "Mary"}</p>
              <label className="sr-only" htmlFor="preview-as">
                Preview as
              </label>
              <select
                id="preview-as"
                value={previewing?.id ?? "owner"}
                onChange={(e) => previewAs(e.target.value === "owner" ? null : e.target.value)}
                className="w-full truncate bg-transparent text-[11px] text-muted-foreground focus-visible:outline-none"
              >
                <option value="owner">Owner view</option>
                {collaborators.map((c) => (
                  <option key={c.id} value={c.id}>
                    Preview as {c.name ?? c.email}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
            <button
              onClick={() => void signOut()}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>

      </aside>

      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        <header className="pt-safe sticky top-0 z-20 flex items-center gap-2 border-b border-hairline bg-background/85 px-4 py-2.5 backdrop-blur md:hidden">
          <Link to="/" className="flex items-baseline gap-1.5">
            <span className="text-title text-[19px] font-semibold">Lumen</span>
            <span className="size-1.5 rounded-full bg-ember" />
          </Link>
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Record a meeting"
            className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-dashed border-border px-3 text-xs text-muted-foreground"
          >
            <Circle className="size-3 fill-ember text-ember" />
            Record
          </button>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="grid size-11 place-items-center text-muted-foreground"
          >
            {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </button>
        </header>
        {previewing ? (
          <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-ember/30 bg-ember-soft px-4 py-2 text-xs text-ember md:px-10">
            <span>
              Previewing as {previewing.name ?? previewing.email} (
              {previewing.role === "editor" ? "Editor" : "Viewer"}) —{" "}
              {previewing.clientIds.length} client{previewing.clientIds.length === 1 ? "" : "s"}
            </span>
            <button
              onClick={() => previewAs(null)}
              className="ml-auto rounded-full border border-ember/40 px-2.5 py-1 font-medium transition-colors hover:bg-ember hover:text-[oklch(0.99_0.005_85)]"
            >
              Exit preview
            </button>
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 md:px-10 md:py-12 md:pb-12">
          {children}
        </main>
      </div>

      <MobileTabBar />


      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder="Jump to a note or run a command…" />
        <CommandList>
          <CommandEmpty>Nothing matches that.</CommandEmpty>
          <CommandGroup heading="Commands">
            {live ? (
              <CommandItem
                onSelect={() => {
                  setPaletteOpen(false);
                  void navigate({ to: "/live/$sessionId", params: { sessionId: live.id } });
                }}
              >
                Open live note — {live.title}
              </CommandItem>
            ) : null}
            {pathname.startsWith("/notes/") ? (
              <CommandItem
                onSelect={() => {
                  setPaletteOpen(false);
                  window.dispatchEvent(new CustomEvent("lumen:play-audio"));
                }}
              >
                Play meeting audio
              </CommandItem>
            ) : null}
            <CommandItem
              onSelect={() => {
                toggleTheme();
                setPaletteOpen(false);
              }}
            >
              Toggle {theme === "light" ? "dark" : "light"} theme
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setPaletteOpen(false);
                void navigate({ to: "/actions" });
              }}
            >
              Review open action items
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setPaletteOpen(false);
                void navigate({ to: "/ideas" });
              }}
            >
              Capture an idea
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setPaletteOpen(false);
                void navigate({ to: "/search" });
              }}
            >
              Search all notes
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Notes">
            {(notes ?? []).map((n) => (
              <CommandItem
                key={n.id}
                value={n.title}
                onSelect={() => {
                  setPaletteOpen(false);
                  void navigate({ to: "/notes/$noteId", params: { noteId: n.id } });
                }}
              >
                {n.title}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
