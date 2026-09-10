import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: DeviceAwareLanding,
});

/**
 * Device-aware landing (Mary, 2026-09-09):
 *   - mobile  -> Ideas      (she captures thoughts out walking, not at a desk)
 *   - desktop -> To-do list (she works from the list the vast majority of the time)
 *
 * This is why Today moved to `/today`: if `/` redirected on mobile, the "Today" tab in the
 * mobile bar would bounce straight back to Ideas and Today would be unreachable. Giving Today
 * its own path keeps it one tap away on both devices.
 */
function DeviceAwareLanding() {
  const navigate = useNavigate();

  useEffect(() => {
    const isMobile =
      typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
    void navigate({ to: isMobile ? "/ideas" : "/actions", replace: true });
  }, [navigate]);

  return (
    <div className="p-6 text-sm text-muted-foreground" role="status">
      Opening Lumen…
    </div>
  );
}
