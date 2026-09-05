import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createContact, listContacts } from "@/lib/api";

/** Offers to save meeting attendees who aren't in the address book yet. */
export function AddAttendees({
  attendees,
  clientId,
}: {
  attendees: string[];
  clientId?: string | undefined;
}) {
  const qc = useQueryClient();
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: () => listContacts() });
  const known = new Set((contacts.data ?? []).map((c) => c.name.toLowerCase()));
  const missing = attendees.filter((a) => a !== "Mary Alcott" && !known.has(a.toLowerCase()));

  const add = useMutation({
    mutationFn: async () => {
      for (const name of missing) {
        await createContact({
          name,
          email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
          clientId,
          role: "client",
          source: "attendee",
        });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(
        missing.length === 1
          ? `${missing[0]} added to contacts`
          : `${missing.length} attendees added to contacts`,
      );
    },
  });

  if (contacts.isLoading || missing.length === 0) return null;

  return (
    <button
      onClick={() => add.mutate()}
      disabled={add.isPending}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-ember hover:underline disabled:opacity-50"
    >
      <UserPlus className="size-3.5" />
      {add.isPending ? "Adding…" : `Add ${missing.length === 1 ? missing[0] : "attendees"} to contacts`}
    </button>
  );
}
