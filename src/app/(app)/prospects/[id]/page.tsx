"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/lib/use-toast";
import {
  formatDate,
  formatDateTime,
  getPriorityColor,
  getPriorityLabel,
  getStatusColor,
  getStatusLabel,
} from "@/lib/utils";

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
const NONE_VALUE = "__NONE__";

const VALID_TRANSITIONS: Record<string, string[]> = {
  NOUVEAU: ["A_CONTACTER", "NE_PLUS_CONTACTER"],
  A_CONTACTER: ["CONTACTE", "NE_PLUS_CONTACTER"],
  CONTACTE: ["INTERESSE", "NON_INTERESSE", "A_RELANCER", "NE_PLUS_CONTACTER"],
  INTERESSE: ["A_RELANCER", "CLIENT", "NON_INTERESSE", "NE_PLUS_CONTACTER"],
  A_RELANCER: ["CONTACTE", "INTERESSE", "NON_INTERESSE", "NE_PLUS_CONTACTER"],
  NON_INTERESSE: ["PERDU", "A_RELANCER", "NE_PLUS_CONTACTER"],
  CLIENT: ["NE_PLUS_CONTACTER"],
  PERDU: ["A_CONTACTER", "NE_PLUS_CONTACTER"],
  NE_PLUS_CONTACTER: [],
};

function toInputDateTime(value?: string | Date | null) {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ProspectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const { toast } = useToast();
  const id = params?.id;

  const { data: prospect, error, isLoading, mutate } = useSWR(
    id ? `/api/prospects/${id}` : null,
    fetcher
  );
  const { data: users } = useSWR(isAdmin ? "/api/users" : null, fetcher);

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");
  const [statusTarget, setStatusTarget] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [activityType, setActivityType] = useState("NOTE");

  function validateProspect() {
    if (!form.companyName.trim()) return "Raison sociale requise.";
    if (!/^\d{9}$/.test(form.siren)) return "Le SIREN doit contenir 9 chiffres.";
    if (form.siret && !/^\d{14}$/.test(form.siret)) return "Le SIRET doit contenir 14 chiffres.";
    if (form.email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(form.email)) return "Email invalide.";
    if (form.website) {
      try {
        const url = new URL(form.website);
        if (!url.protocol.startsWith("http")) throw new Error("invalid");
      } catch {
        return "URL du site invalide.";
      }
    }
    return "";
  }

  const [form, setForm] = useState({
    companyName: "",
    siren: "",
    siret: "",
    legalForm: "",
    nafCode: "",
    nafLabel: "",
    address: "",
    postalCode: "",
    city: "",
    region: "",
    website: "",
    phone: "",
    email: "",
    employeeCount: "",
    assignedToId: "",
    nextFollowUpAt: "",
    followUpNote: "",
  });

  const setFormFromProspect = () => {
    if (!prospect) return;
    setForm({
      companyName: prospect.companyName || "",
      siren: prospect.siren || "",
      siret: prospect.siret || "",
      legalForm: prospect.legalForm || "",
      nafCode: prospect.nafCode || "",
      nafLabel: prospect.nafLabel || "",
      address: prospect.address || "",
      postalCode: prospect.postalCode || "",
      city: prospect.city || "",
      region: prospect.region || "",
      website: prospect.website || "",
      phone: prospect.phone || "",
      email: prospect.email || "",
      employeeCount: prospect.employeeCount?.toString() || "",
      assignedToId: prospect.assignedToId || "",
      nextFollowUpAt: toInputDateTime(prospect.nextFollowUpAt),
      followUpNote: prospect.followUpNote || "",
    });
  };

  useEffect(() => {
    setFormFromProspect();
  }, [prospect]);

  const availableStatuses = useMemo(() => {
    if (!prospect) return [];
    if (isAdmin) return STATUS_OPTIONS;
    return VALID_TRANSITIONS[prospect.status] || [];
  }, [prospect, isAdmin]);

  async function handleSave() {
    if (!prospect) return;
    setSaving(true);
    setSaveError("");

    const localError = validateProspect();
    if (localError) {
      setSaveError(localError);
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      companyName: form.companyName,
      siren: form.siren,
      siret: form.siret || undefined,
      legalForm: form.legalForm || undefined,
      nafCode: form.nafCode || undefined,
      nafLabel: form.nafLabel || undefined,
      address: form.address || undefined,
      postalCode: form.postalCode || undefined,
      city: form.city || undefined,
      region: form.region || undefined,
      website: form.website || "",
      phone: form.phone || undefined,
      email: form.email || "",
      employeeCount: form.employeeCount ? Number(form.employeeCount) : undefined,
      nextFollowUpAt: form.nextFollowUpAt
        ? new Date(form.nextFollowUpAt).toISOString()
        : null,
      followUpNote: form.followUpNote || null,
    };

    if (isAdmin) {
      payload.assignedToId = form.assignedToId || null;
    }

    const res = await fetch(`/api/prospects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setSaveError(json?.error || "Impossible de sauvegarder");
      toast({
        title: "Sauvegarde impossible",
        description: json?.error || "Erreur inconnue.",
        variant: "destructive",
      });
      return;
    }

    setEditMode(false);
    mutate();
    toast({
      title: "Prospect mis à jour",
      description: "Les informations ont été sauvegardées.",
      variant: "success",
    });
  }

  async function handleStatusChange() {
    if (!statusTarget) return;
    if (["NE_PLUS_CONTACTER", "CLIENT", "PERDU"].includes(statusTarget)) {
      const ok = window.confirm("Confirmer ce changement de statut ?");
      if (!ok) return;
    }
    setStatusLoading(true);
    setStatusError("");

    const res = await fetch(`/api/prospects/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: statusTarget, reason: statusReason || undefined }),
    });

    setStatusLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setStatusError(json?.error || "Impossible de changer le statut");
      toast({
        title: "Changement de statut impossible",
        description: json?.error || "Erreur inconnue.",
        variant: "destructive",
      });
      return;
    }

    setStatusTarget("");
    setStatusReason("");
    mutate();
    toast({
      title: "Statut mis à jour",
      description: `Nouveau statut: ${getStatusLabel(statusTarget)}.`,
      variant: "success",
    });
  }

  async function handleActivitySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActivityLoading(true);
    setActivityError("");

    const formData = new FormData(e.currentTarget);
    const payload = {
      type: activityType,
      title: String(formData.get("title") || ""),
      content: String(formData.get("content") || "").trim() || undefined,
      scheduledAt: formData.get("scheduledAt")
        ? new Date(String(formData.get("scheduledAt"))).toISOString()
        : undefined,
    };

    const res = await fetch(`/api/prospects/${id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setActivityLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setActivityError(json?.error || "Impossible d'ajouter l'activité");
      toast({
        title: "Ajout impossible",
        description: json?.error || "Erreur inconnue.",
        variant: "destructive",
      });
      return;
    }

    setActivityType("NOTE");
    (e.target as HTMLFormElement).reset();
    mutate();
    toast({
      title: "Activité ajoutée",
      description: "L'activité a été enregistrée.",
      variant: "success",
    });
  }

  async function handleDelete() {
    if (!isAdmin) return;
    const ok = window.confirm("Supprimer ce prospect ? Cette action est irréversible.");
    if (!ok) return;

    const res = await fetch(`/api/prospects/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast({
        title: "Suppression impossible",
        description: json?.error || "Erreur inconnue.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Prospect supprimé",
      description: "Le prospect a été supprimé.",
      variant: "success",
    });
    router.push("/prospects");
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Impossible de charger ce prospect.
      </div>
    );
  }

  if (isLoading || !prospect) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/prospects" className="text-sm text-muted-foreground hover:underline">
            ← Retour aux prospects
          </Link>
          <h1 className="text-2xl font-semibold">{prospect.companyName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className={getStatusColor(prospect.status)}>{getStatusLabel(prospect.status)}</Badge>
            <Badge className={getPriorityColor(prospect.priority)}>{getPriorityLabel(prospect.priority)}</Badge>
            <span className="text-sm text-muted-foreground">Score {prospect.score}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setFormFromProspect();
                  setEditMode(false);
                }}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Sauvegarde..." : "Enregistrer"}
              </Button>
            </>
          ) : (
            <Button onClick={() => setEditMode(true)}>Éditer</Button>
          )}
          {isAdmin && (
            <Button variant="destructive" onClick={handleDelete}>
              Supprimer
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {saveError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {saveError}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Raison sociale</Label>
                <Input
                  value={form.companyName}
                  onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label>SIREN</Label>
                <Input
                  value={form.siren}
                  onChange={(e) => setForm((prev) => ({ ...prev, siren: e.target.value }))}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label>SIRET</Label>
                <Input
                  value={form.siret}
                  onChange={(e) => setForm((prev) => ({ ...prev, siret: e.target.value }))}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label>Forme légale</Label>
                <Input
                  value={form.legalForm}
                  onChange={(e) => setForm((prev) => ({ ...prev, legalForm: e.target.value }))}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label>Code NAF</Label>
                <Input
                  value={form.nafCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, nafCode: e.target.value }))}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label>Libellé NAF</Label>
                <Input
                  value={form.nafLabel}
                  onChange={(e) => setForm((prev) => ({ ...prev, nafLabel: e.target.value }))}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label>Adresse</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label>Code postal</Label>
                <Input
                  value={form.postalCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, postalCode: e.target.value }))}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label>Région</Label>
                <Input
                  value={form.region}
                  onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label>Site web</Label>
                <Input
                  value={form.website}
                  onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label>Effectif</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.employeeCount}
                  onChange={(e) => setForm((prev) => ({ ...prev, employeeCount: e.target.value }))}
                  disabled={!editMode}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Assigné à</Label>
                {isAdmin && editMode ? (
                  <Select
                    value={form.assignedToId || NONE_VALUE}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        assignedToId: value === NONE_VALUE ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Non assigné" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Non assigné</SelectItem>
                      {users?.map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={prospect.assignedTo?.name || "Non assigné"} disabled />
                )}
              </div>
              <div className="space-y-2">
                <Label>Dernier contact</Label>
                <Input value={formatDateTime(prospect.lastContactedAt)} disabled />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Prochaine relance</Label>
                <Input
                  type="datetime-local"
                  value={form.nextFollowUpAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, nextFollowUpAt: e.target.value }))}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label>Note de relance</Label>
                <Textarea
                  value={form.followUpNote}
                  onChange={(e) => setForm((prev) => ({ ...prev, followUpNote: e.target.value }))}
                  disabled={!editMode}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Changement de statut</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {statusError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {statusError}
                </div>
              )}
              <Select value={statusTarget} onValueChange={setStatusTarget}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un statut" />
                </SelectTrigger>
                <SelectContent>
                  {availableStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {getStatusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Raison / commentaire"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
              />
              <Button onClick={handleStatusChange} disabled={!statusTarget || statusLoading}>
                {statusLoading ? "Mise à jour..." : "Changer le statut"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Résumé</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Créé</span>
                <span>{formatDate(prospect.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mis à jour</span>
                <span>{formatDate(prospect.updatedAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Directeurs</span>
                <span>{prospect.directors?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Activités</span>
                <span>{prospect.activities?.length || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nouvelle activité</CardTitle>
          </CardHeader>
          <CardContent>
            {activityError && (
              <div className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {activityError}
              </div>
            )}
            <form onSubmit={handleActivitySubmit} className="space-y-3">
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPEL">Appel</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="NOTE">Note</SelectItem>
                  <SelectItem value="RELANCE">Relance</SelectItem>
                </SelectContent>
              </Select>
              <Input name="title" placeholder="Titre" required />
              <Textarea name="content" placeholder="Détails" />
              <Input name="scheduledAt" type="datetime-local" />
              <Button type="submit" disabled={activityLoading}>
                {activityLoading ? "Ajout..." : "Ajouter"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historique de statut</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {prospect.statusHistory?.length === 0 && (
              <div className="text-sm text-muted-foreground">Aucun changement de statut.</div>
            )}
            {prospect.statusHistory?.map((entry: any) => (
              <div key={entry.id} className="border-b pb-3 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {entry.fromStatus ? `${getStatusLabel(entry.fromStatus)} → ` : ""}
                    {getStatusLabel(entry.toStatus)}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
                </div>
                {entry.reason && <div className="text-xs text-muted-foreground">{entry.reason}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activités récentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {prospect.activities?.length === 0 && (
              <div className="text-sm text-muted-foreground">Aucune activité pour le moment.</div>
            )}
            {prospect.activities?.map((activity: any) => (
              <div key={activity.id} className="border-b pb-3 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{activity.title}</div>
                  <span className="text-xs text-muted-foreground">{formatDateTime(activity.createdAt)}</span>
                </div>
                <div className="text-xs text-muted-foreground">{activity.user?.name || ""}</div>
                {activity.content && <div className="text-sm">{activity.content}</div>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dirigeants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {prospect.directors?.length === 0 && (
              <div className="text-sm text-muted-foreground">Aucun dirigeant renseigné.</div>
            )}
            {prospect.directors?.map((director: any) => (
              <div key={director.id} className="border-b pb-3 last:border-0">
                <div className="text-sm font-medium">
                  {director.firstName ? `${director.firstName} ` : ""}{director.lastName}
                </div>
                <div className="text-xs text-muted-foreground">{director.role || ""}</div>
                {director.email && <div className="text-xs">{director.email}</div>}
                {director.phone && <div className="text-xs">{director.phone}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
