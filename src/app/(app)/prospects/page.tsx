"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatDateTime, getPriorityColor, getPriorityLabel, getStatusColor, getStatusLabel } from "@/lib/utils";
import { useToast } from "@/lib/use-toast";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const STATUS_OPTIONS = [
  "NOUVEAU",
  "A_CONTACTER",
  "CONTACTE",
  "INTERESSE",
  "A_RELANCER",
  "CLIENT",
  "NON_INTERESSE",
  "PERDU",
  "NE_PLUS_CONTACTER",
];
const ALL_VALUE = "ALL";

export default function ProspectsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const limit = 20;

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (assignedToId) params.set("assignedToId", assignedToId);
    if (minScore) params.set("minScore", minScore);
    if (maxScore) params.set("maxScore", maxScore);
    if (sortBy) params.set("sortBy", sortBy);
    if (sortOrder) params.set("sortOrder", sortOrder);
    return params.toString();
  }, [page, limit, search, status, assignedToId, minScore, maxScore, sortBy, sortOrder]);

  const { data, error, isLoading, mutate } = useSWR(`/api/prospects?${query}`, fetcher);
  const { data: users } = useSWR(isAdmin ? "/api/users" : null, fetcher);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  function formatValidationError(details?: Record<string, string[]>) {
    if (!details) return "";
    const messages = Object.values(details).flat();
    return messages.filter(Boolean).join(" · ");
  }

  function validateCreate(payload: {
    siren: string;
    companyName: string;
    email?: string;
    website?: string;
  }) {
    if (!/^\d{9}$/.test(payload.siren)) return "Le SIREN doit contenir 9 chiffres.";
    if (!payload.companyName.trim()) return "Raison sociale requise.";
    if (payload.email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(payload.email))
      return "Email invalide.";
    if (payload.website) {
      try {
        const url = new URL(payload.website);
        if (!url.protocol.startsWith("http")) throw new Error("invalid");
      } catch {
        return "URL du site invalide.";
      }
    }
    return "";
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError("");
    setCreating(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      siren: String(formData.get("siren") || "").trim(),
      companyName: String(formData.get("companyName") || "").trim(),
      city: String(formData.get("city") || "").trim() || undefined,
      email: String(formData.get("email") || "").trim() || undefined,
      phone: String(formData.get("phone") || "").trim() || undefined,
      website: String(formData.get("website") || "").trim() || undefined,
      employeeCount: formData.get("employeeCount")
        ? Number(formData.get("employeeCount"))
        : undefined,
    };

    const localError = validateCreate({
      siren: payload.siren,
      companyName: payload.companyName,
      email: payload.email,
      website: payload.website,
    });
    if (localError) {
      setCreateError(localError);
      setCreating(false);
      return;
    }

    const res = await fetch("/api/prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      const details = json?.details?.fieldErrors;
      setCreateError(
        formatValidationError(details) || json?.error || "Impossible de créer le prospect"
      );
      toast({
        title: "Création impossible",
        description: formatValidationError(details) || json?.error || "Erreur inconnue.",
        variant: "destructive",
      });
      setCreating(false);
      return;
    }

    setDialogOpen(false);
    setCreating(false);
    mutate();
    toast({
      title: "Prospect créé",
      description: `${payload.companyName} a été ajouté.`,
      variant: "success",
    });
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Impossible de charger les prospects.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Prospects</h1>
          <p className="text-sm text-muted-foreground">Suivi des prospects et actions en cours.</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setCreateError("");
          }}
        >
          <DialogTrigger asChild>
            <Button>Nouveau prospect</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Créer un prospect</DialogTitle>
              <DialogDescription>Ajoutez un prospect manuellement.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              {createError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {createError}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="siren">SIREN</Label>
                  <Input
                    id="siren"
                    name="siren"
                    required
                    minLength={9}
                    maxLength={9}
                    inputMode="numeric"
                    pattern="\\d{9}"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Raison sociale</Label>
                  <Input id="companyName" name="companyName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input id="city" name="city" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input id="phone" name="phone" inputMode="tel" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Site web</Label>
                  <Input id="website" name="website" type="url" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employeeCount">Effectif</Label>
                  <Input id="employeeCount" name="employeeCount" type="number" min={0} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? "Création..." : "Créer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Input
            placeholder="Rechercher entreprise, SIREN, email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={status || ALL_VALUE}
          onValueChange={(value) => {
            setStatus(value === ALL_VALUE ? "" : value);
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tous les statuts</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {getStatusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Select
            value={assignedToId || ALL_VALUE}
            onValueChange={(value) => {
              setAssignedToId(value === ALL_VALUE ? "" : value);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Assigné à" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Tous les commerciaux</SelectItem>
              {users?.map((user: any) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select
          value={`${sortBy}:${sortOrder}`}
          onValueChange={(value) => {
            const [field, order] = value.split(":");
            setSortBy(field);
            setSortOrder(order as "asc" | "desc");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Tri" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt:desc">Derniers créés</SelectItem>
            <SelectItem value="createdAt:asc">Plus anciens</SelectItem>
            <SelectItem value="score:desc">Score décroissant</SelectItem>
            <SelectItem value="score:asc">Score croissant</SelectItem>
            <SelectItem value="companyName:asc">Nom A-Z</SelectItem>
            <SelectItem value="companyName:desc">Nom Z-A</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Score min</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => {
              setMinScore(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>Score max</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={maxScore}
            onChange={(e) => {
              setMaxScore(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Entreprise</th>
              <th className="px-4 py-3 text-left font-medium">SIREN</th>
              <th className="px-4 py-3 text-left font-medium">Ville</th>
              <th className="px-4 py-3 text-left font-medium">Statut</th>
              <th className="px-4 py-3 text-left font-medium">Score</th>
              <th className="px-4 py-3 text-left font-medium">Assigné</th>
              <th className="px-4 py-3 text-left font-medium">Prochaine relance</th>
              <th className="px-4 py-3 text-left font-medium">Créé</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-6" colSpan={9}>
                  Chargement...
                </td>
              </tr>
            )}
            {!isLoading && data?.prospects?.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={9}>
                  Aucun prospect trouvé.
                </td>
              </tr>
            )}
            {data?.prospects?.map((prospect: any) => (
              <tr key={prospect.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{prospect.companyName}</div>
                  <div className="text-xs text-muted-foreground">{prospect.email || "-"}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{prospect.siren}</td>
                <td className="px-4 py-3 text-muted-foreground">{prospect.city || "-"}</td>
                <td className="px-4 py-3">
                  <Badge className={getStatusColor(prospect.status)}>{getStatusLabel(prospect.status)}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{prospect.score}</div>
                  <Badge className={getPriorityColor(prospect.priority)}>{getPriorityLabel(prospect.priority)}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {prospect.assignedTo?.name || "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDateTime(prospect.nextFollowUpAt)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(prospect.createdAt)}</td>
                <td className="px-4 py-3">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/prospects/${prospect.id}`}>Voir</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {data?.pagination?.page || 1} / {data?.pagination?.totalPages || 1} · {data?.pagination?.total || 0} prospects
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Précédent
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= (data?.pagination?.totalPages || 1)}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </Button>
        </div>
      </div>
    </div>
  );
}
