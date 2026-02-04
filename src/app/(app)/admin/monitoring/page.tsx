"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/lib/use-toast";
import { formatDateTime } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ImportBatch = {
  id: string;
  source: string;
  totalFound: number;
  newInserted: number;
  duplicatesSkipped: number;
  enriched: number;
  scored: number;
  assigned: number;
  errors: number;
  status: string;
  startedAt: string;
  completedAt: string | null;
};

type EnrichLog = {
  id: string;
  source: string;
  endpoint: string | null;
  success: boolean;
  responseMs: number | null;
  error: string | null;
  creditsUsed: number;
  createdAt: string;
  prospect: { companyName: string; siren: string };
};

type SourceStats = Record<
  string,
  { total: number; success: number; failed: number; avgMs: number }
>;

export default function MonitoringPage() {
  const { toast } = useToast();
  const { data, error, isLoading, mutate } = useSWR("/api/jobs", fetcher, {
    refreshInterval: 10000,
  });

  const [detectFrom, setDetectFrom] = useState("");
  const [detectTo, setDetectTo] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function triggerAction(action: string, extra: Record<string, string> = {}) {
    setActionLoading(action);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: "Erreur", description: json.error || "Erreur", variant: "destructive" });
      } else {
        toast({ title: "Action lancée", description: json.message, variant: "success" });
        mutate();
      }
    } catch {
      toast({ title: "Erreur réseau", description: "Impossible de contacter le serveur.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  const batches: ImportBatch[] = data?.importBatches || [];
  const sourceStats: SourceStats = data?.enrichmentStats || {};
  const recentLogs: EnrichLog[] = data?.recentLogs || [];

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Impossible de charger les données de monitoring.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Monitoring des jobs</h1>
        <p className="text-sm text-muted-foreground">
          Suivi des imports, enrichissements et traitements automatiques.
        </p>
      </div>

      {/* Actions manuelles */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Détection manuelle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Date début</Label>
              <Input type="date" value={detectFrom} onChange={(e) => setDetectFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date fin</Label>
              <Input type="date" value={detectTo} onChange={(e) => setDetectTo(e.target.value)} />
            </div>
            <Button
              className="w-full"
              disabled={actionLoading === "detect"}
              onClick={() =>
                triggerAction("detect", {
                  ...(detectFrom && { dateFrom: detectFrom }),
                  ...(detectTo && { dateTo: detectTo }),
                })
              }
            >
              {actionLoading === "detect" ? "Lancement..." : "Lancer la détection"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Scoring global</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Re-score tous les prospects NOUVEAU et A_CONTACTER.
            </p>
            <Button
              className="w-full"
              variant="secondary"
              disabled={actionLoading === "score-all"}
              onClick={() => triggerAction("score-all")}
            >
              {actionLoading === "score-all" ? "Lancement..." : "Lancer le scoring"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Stats enrichissement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(sourceStats).length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune donnée.</p>
            )}
            {Object.entries(sourceStats).map(([source, stats]) => (
              <div key={source} className="flex items-center justify-between text-sm">
                <span className="font-medium">{source}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{stats.total} req</Badge>
                  <span className="text-green-600">{stats.success} ok</span>
                  {stats.failed > 0 && <span className="text-red-600">{stats.failed} err</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Import Batches */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des imports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Source</th>
                  <th className="px-3 py-2 text-left font-medium">Statut</th>
                  <th className="px-3 py-2 text-right font-medium">Trouvés</th>
                  <th className="px-3 py-2 text-right font-medium">Nouveaux</th>
                  <th className="px-3 py-2 text-right font-medium">Doublons</th>
                  <th className="px-3 py-2 text-right font-medium">Enrichis</th>
                  <th className="px-3 py-2 text-right font-medium">Scorés</th>
                  <th className="px-3 py-2 text-right font-medium">Assignés</th>
                  <th className="px-3 py-2 text-right font-medium">Erreurs</th>
                  <th className="px-3 py-2 text-left font-medium">Début</th>
                  <th className="px-3 py-2 text-left font-medium">Fin</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td className="px-3 py-4" colSpan={11}>Chargement...</td>
                  </tr>
                )}
                {!isLoading && batches.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-muted-foreground" colSpan={11}>Aucun import.</td>
                  </tr>
                )}
                {batches.map((batch) => (
                  <tr key={batch.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{batch.source}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          batch.status === "COMPLETED"
                            ? "default"
                            : batch.status === "FAILED"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {batch.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">{batch.totalFound}</td>
                    <td className="px-3 py-2 text-right">{batch.newInserted}</td>
                    <td className="px-3 py-2 text-right">{batch.duplicatesSkipped}</td>
                    <td className="px-3 py-2 text-right">{batch.enriched}</td>
                    <td className="px-3 py-2 text-right">{batch.scored}</td>
                    <td className="px-3 py-2 text-right">{batch.assigned}</td>
                    <td className="px-3 py-2 text-right">{batch.errors}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDateTime(batch.startedAt)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDateTime(batch.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent enrichment logs */}
      <Card>
        <CardHeader>
          <CardTitle>Logs d&apos;enrichissement récents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Entreprise</th>
                  <th className="px-3 py-2 text-left font-medium">Source</th>
                  <th className="px-3 py-2 text-left font-medium">Endpoint</th>
                  <th className="px-3 py-2 text-left font-medium">Résultat</th>
                  <th className="px-3 py-2 text-right font-medium">Temps (ms)</th>
                  <th className="px-3 py-2 text-right font-medium">Crédits</th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td className="px-3 py-4" colSpan={7}>Chargement...</td>
                  </tr>
                )}
                {!isLoading && recentLogs.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-muted-foreground" colSpan={7}>Aucun log.</td>
                  </tr>
                )}
                {recentLogs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium">{log.prospect.companyName}</div>
                      <div className="text-xs text-muted-foreground">{log.prospect.siren}</div>
                    </td>
                    <td className="px-3 py-2">{log.source}</td>
                    <td className="px-3 py-2 text-muted-foreground">{log.endpoint || "-"}</td>
                    <td className="px-3 py-2">
                      <Badge variant={log.success ? "default" : "destructive"}>
                        {log.success ? "OK" : "Erreur"}
                      </Badge>
                      {log.error && (
                        <div className="mt-1 max-w-xs truncate text-xs text-muted-foreground" title={log.error}>
                          {log.error}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{log.responseMs ?? "-"}</td>
                    <td className="px-3 py-2 text-right">{log.creditsUsed}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDateTime(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
