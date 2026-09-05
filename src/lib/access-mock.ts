import type { Collaborator, ShareLink } from "./types";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export const seedCollaborators: Collaborator[] = [
  {
    id: "col-jordan",
    email: "jordan@quietcraft.studio",
    name: "Jordan Reyes",
    role: "editor",
    clientIds: ["c-willow", "c-harbor"],
    status: "active",
    lastActiveAt: daysAgo(2),
    invitedAtISO: daysAgo(46),
  },
  {
    id: "col-priya",
    email: "priya.n@copydesk.co",
    name: "Priya Nadar",
    role: "viewer",
    clientIds: ["c-brightline"],
    status: "invited",
    invitedAtISO: daysAgo(5),
  },
];

export const seedShareLinks: ShareLink[] = [
  {
    id: "sl-1",
    target: { type: "note", id: "n-1" },
    label: "Willow & Vine — packaging review",
    permission: "view",
    token: "wv7k2m9q",
    expiresAtISO: new Date(Date.now() + 21 * 86_400_000).toISOString(),
    revoked: false,
    createdAtISO: daysAgo(9),
  },
  {
    id: "sl-2",
    target: { type: "client", id: "c-harbor" },
    label: "Harbor Coffee Co. — workspace",
    permission: "edit",
    token: "hc4a1x8t",
    revoked: true,
    createdAtISO: daysAgo(31),
  },
];
