import { Link } from "@tanstack/react-router";
import { Briefcase, CheckCircle2, FileText, Home, LayoutTemplate, Search } from "lucide-react";

const tabs = [
  { to: "/", label: "Today", icon: Home, exact: true },
  { to: "/notes", label: "Notes", icon: FileText, exact: false },
  { to: "/actions", label: "Actions", icon: CheckCircle2, exact: false },
  { to: "/clients", label: "Clients", icon: Briefcase, exact: false },
  { to: "/templates", label: "Files", icon: LayoutTemplate, exact: false },
  { to: "/search", label: "Search", icon: Search, exact: false },
] as const;

export function MobileTabBar() {
  return (
    <nav
      aria-label="Primary"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/95 backdrop-blur md:hidden"
    >
      <ul className="flex items-stretch">
        {tabs.map((t) => (
          <li key={t.to} className="flex-1">
            <Link
              to={t.to}
              activeOptions={{ exact: t.exact }}
              aria-label={t.label}
              className="group relative flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium text-muted-foreground transition-colors data-[status=active]:text-ember"
            >
              <span className="absolute top-0 h-0.5 w-8 rounded-full bg-transparent group-data-[status=active]:bg-ember" />
              <t.icon className="size-5" />
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
