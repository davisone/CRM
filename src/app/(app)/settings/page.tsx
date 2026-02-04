"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/lib/use-toast";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Setting = {
  id: string;
  key: string;
  value: string;
  type: string;
};

const SETTING_LABELS: Record<string, { label: string; description: string }> = {
  score_threshold_qualify: {
    label: "Seuil de qualification (score)",
    description: "Score minimum pour passer automatiquement un prospect de NOUVEAU à A_CONTACTER",
  },
  score_threshold_hot: {
    label: "Seuil Hot (score)",
    description: "Score minimum pour la priorité Hot (assignation vers Commercial)",
  },
  max_enrichment_per_day: {
    label: "Enrichissements max / jour",
    description: "Nombre maximum d'appels API d'enrichissement par jour",
  },
  inpi_detection_cron: {
    label: "CRON détection INPI",
    description: "Expression cron pour la détection automatique",
  },
  max_parallel_enrichments: {
    label: "Enrichissements parallèles",
    description: "Nombre de jobs d'enrichissement simultanés",
  },
  auto_assign_enabled: {
    label: "Assignation automatique",
    description: "Activer l'assignation automatique des prospects qualifiés",
  },
  auto_qualify_enabled: {
    label: "Qualification automatique",
    description: "Activer la qualification automatique selon le score",
  },
  pappers_daily_budget: {
    label: "Budget Pappers / jour",
    description: "Nombre max de requêtes Pappers par jour",
  },
  google_places_daily_budget: {
    label: "Budget Google Places / jour",
    description: "Nombre max de requêtes Google Places par jour",
  },
  follow_up_default_days: {
    label: "Relance par défaut (jours)",
    description: "Nombre de jours par défaut pour une relance",
  },
};

export default function SettingsPage() {
  const { toast } = useToast();
  const { data, error, isLoading, mutate } = useSWR<Setting[]>("/api/settings", fetcher);

  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      const values: Record<string, string> = {};
      for (const s of data) {
        values[s.key] = s.value;
      }
      setForm(values);
    }
  }, [data]);

  async function handleSave() {
    setSaving(true);
    const payload = Object.entries(form).map(([key, value]) => ({
      key,
      value,
      type: data?.find((s) => s.key === key)?.type || "string",
    }));

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!res.ok) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder.", variant: "destructive" });
    } else {
      mutate();
      toast({ title: "Paramètres sauvegardés", description: "Les modifications ont été enregistrées.", variant: "success" });
    }
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Impossible de charger les paramètres.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Paramètres</h1>
          <p className="text-sm text-muted-foreground">Configuration du scoring, des APIs et des automatisations.</p>
        </div>
        <Button onClick={handleSave} disabled={saving || isLoading}>
          {saving ? "Sauvegarde..." : "Enregistrer"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Scoring & Qualification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {["score_threshold_qualify", "score_threshold_hot", "auto_qualify_enabled", "auto_assign_enabled"].map(
              (key) => {
                const meta = SETTING_LABELS[key];
                if (!meta) return null;
                const settingType = data?.find((s) => s.key === key)?.type;
                return (
                  <div key={key} className="space-y-1">
                    <Label>{meta.label}</Label>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                    {settingType === "boolean" ? (
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={form[key] || ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                      >
                        <option value="true">Activé</option>
                        <option value="false">Désactivé</option>
                      </select>
                    ) : (
                      <Input
                        type={settingType === "number" ? "number" : "text"}
                        value={form[key] || ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                      />
                    )}
                  </div>
                );
              }
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enrichissement & APIs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "max_enrichment_per_day",
              "max_parallel_enrichments",
              "pappers_daily_budget",
              "google_places_daily_budget",
            ].map((key) => {
              const meta = SETTING_LABELS[key];
              if (!meta) return null;
              return (
                <div key={key} className="space-y-1">
                  <Label>{meta.label}</Label>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                  <Input
                    type="number"
                    value={form[key] || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Planification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {["inpi_detection_cron", "follow_up_default_days"].map((key) => {
              const meta = SETTING_LABELS[key];
              if (!meta) return null;
              return (
                <div key={key} className="space-y-1">
                  <Label>{meta.label}</Label>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                  <Input
                    value={form[key] || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
