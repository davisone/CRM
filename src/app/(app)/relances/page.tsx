"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime, getStatusColor, getStatusLabel } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type FollowUpScope = "UPCOMING" | "OVERDUE" | "ALL";

export default function RelancesPage() {
  const [scope, setScope] = useState<FollowUpScope>("UPCOMING");
  const [page, setPage] = useState(1);
  const limit = 20;

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    params.set("followUp", "1");
    params.set("sortBy", "nextFollowUpAt");
    params.set("sortOrder", "asc");

    const now = new Date();
    if (scope === "UPCOMING") {
      const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      params.set("followUpFrom", now.toISOString());
      params.set("followUpTo", to.toISOString());
    }
    if (scope === "OVERDUE") {
      params.set("followUpTo", now.toISOString());
    }

    return params.toString();
  }, [page, limit, scope]);

  const { data, error, isLoading } = useSWR(`/api/prospects?${query}`, fetcher);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Impossible de charger les relances.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Relances</h1>
          <p className="text-sm text-muted-foreground">Planifiez et suivez les relances à venir.</p>
        </div>
        <Select
          value={scope}
          onValueChange={(value) => {
            setScope(value as FollowUpScope);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Filtre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UPCOMING">À venir (14 jours)</SelectItem>
            <SelectItem value="OVERDUE">En retard</SelectItem>
            <SelectItem value="ALL">Tout afficher</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Entreprise</th>
              <th className="px-4 py-3 text-left font-medium">Statut</th>
              <th className="px-4 py-3 text-left font-medium">Assigné</th>
              <th className="px-4 py-3 text-left font-medium">Relance</th>
              <th className="px-4 py-3 text-left font-medium">Note</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-6" colSpan={6}>
                  Chargement...
                </td>
              </tr>
            )}
            {!isLoading && data?.prospects?.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                  Aucune relance à afficher.
                </td>
              </tr>
            )}
            {data?.prospects?.map((prospect: any) => (
              <tr key={prospect.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{prospect.companyName}</div>
                  <div className="text-xs text-muted-foreground">{prospect.city || "-"}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge className={getStatusColor(prospect.status)}>{getStatusLabel(prospect.status)}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {prospect.assignedTo?.name || "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDateTime(prospect.nextFollowUpAt)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {prospect.followUpNote || "-"}
                </td>
                <td className="px-4 py-3">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/prospects/${prospect.id}`}>Ouvrir</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {data?.pagination?.page || 1} / {data?.pagination?.totalPages || 1} · {data?.pagination?.total || 0} relances
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
