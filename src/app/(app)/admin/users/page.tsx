"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/lib/use-toast";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const ROLES = ["ADMIN", "COMMERCIAL", "TELEPROSPECTEUR"] as const;

export default function AdminUsersPage() {
  const { toast } = useToast();
  const { data, error, isLoading, mutate } = useSWR("/api/users", fetcher);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const [role, setRole] = useState<string>("COMMERCIAL");
  const [maxProspects, setMaxProspects] = useState("100");

  const users = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError("");
    setCreating(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      email: String(formData.get("email") || "").trim(),
      name: String(formData.get("name") || "").trim(),
      password: String(formData.get("password") || ""),
      role,
      maxProspects: Number(maxProspects || 100),
    };

    if (!payload.email || !payload.name || !payload.password) {
      setCreateError("Tous les champs sont requis.");
      setCreating(false);
      return;
    }

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setCreateError(json?.error || "Impossible de créer l'utilisateur");
      toast({
        title: "Création impossible",
        description: json?.error || "Erreur inconnue.",
        variant: "destructive",
      });
      setCreating(false);
      return;
    }

    setDialogOpen(false);
    setCreating(false);
    mutate();
    toast({
      title: "Utilisateur créé",
      description: `${payload.name} a été ajouté.`,
      variant: "success",
    });
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Impossible de charger les utilisateurs.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Utilisateurs</h1>
          <p className="text-sm text-muted-foreground">Gestion des comptes et rôles.</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setCreateError("");
          }}
        >
          <DialogTrigger asChild>
            <Button>Nouvel utilisateur</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Créer un utilisateur</DialogTitle>
              <DialogDescription>Ajoutez un compte et définissez son rôle.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              {createError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {createError}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input id="password" name="password" type="password" required minLength={6} />
                </div>
                <div className="space-y-2">
                  <Label>Rôle</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxProspects">Max prospects</Label>
                  <Input
                    id="maxProspects"
                    name="maxProspects"
                    type="number"
                    min={1}
                    value={maxProspects}
                    onChange={(e) => setMaxProspects(e.target.value)}
                  />
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

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Nom</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Rôle</th>
              <th className="px-4 py-3 text-left font-medium">Actif</th>
              <th className="px-4 py-3 text-left font-medium">Max prospects</th>
              <th className="px-4 py-3 text-left font-medium">En cours</th>
              <th className="px-4 py-3 text-left font-medium">Créé</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-6" colSpan={7}>
                  Chargement...
                </td>
              </tr>
            )}
            {!isLoading && users.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                  Aucun utilisateur.
                </td>
              </tr>
            )}
            {users.map((user: any) => (
              <tr key={user.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{user.name}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{user.role}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {user.isActive ? "Oui" : "Non"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{user.maxProspects}</td>
                <td className="px-4 py-3 text-muted-foreground">{user._count?.prospects ?? 0}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
