"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime, getStatusColor, getStatusLabel, getPriorityLabel, getPriorityColor } from "@/lib/utils";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type DashboardData = {
  totalProspects: number;
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  aContacter: number;
  enCours: number;
  clients: number;
  recentProspects: Array<{
    id: string;
    companyName: string;
    status: string;
    score: number;
    city: string | null;
    createdAt: string;
  }>;
  upcomingFollowUps: Array<{
    id: string;
    companyName: string;
    status: string;
    nextFollowUpAt: string | null;
    followUpNote: string | null;
    assignedTo?: { name: string } | null;
  }>;
  recentActivities: Array<{
    id: string;
    type: string;
    title: string;
    createdAt: string;
    user: { name: string };
    prospect: { id: string; companyName: string };
  }>;
};

export default function DashboardPage() {
  const { data, error, isLoading } = useSWR<DashboardData>("/api/dashboard", fetcher);

  const statusData = (data?.statusCounts ? Object.entries(data.statusCounts) : []).map(
    ([status, count]) => ({
      name: getStatusLabel(status),
      value: count,
    })
  );
  const priorityData = [1, 2, 3, 4, 5].map((priority) => ({
    name: getPriorityLabel(priority),
    value: data?.priorityCounts?.[priority] ?? 0,
  }));
  const priorityColors = ["#ef4444", "#f97316", "#0ea5e9", "#94a3b8", "#e2e8f0"];

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Impossible de charger le dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Vue rapide de la prospection et des priorités.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total prospects</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {isLoading ? "..." : data?.totalProspects ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">À contacter</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {isLoading ? "..." : data?.aContacter ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">En cours</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {isLoading ? "..." : data?.enCours ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Clients</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {isLoading ? "..." : data?.clients ?? 0}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Prospects récents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="py-2 text-left font-medium">Entreprise</th>
                    <th className="py-2 text-left font-medium">Ville</th>
                    <th className="py-2 text-left font-medium">Statut</th>
                    <th className="py-2 text-left font-medium">Score</th>
                    <th className="py-2 text-left font-medium">Créé</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td className="py-4" colSpan={5}>
                        Chargement...
                      </td>
                    </tr>
                  )}
                  {!isLoading && data?.recentProspects?.length === 0 && (
                    <tr>
                      <td className="py-4 text-muted-foreground" colSpan={5}>
                        Aucun prospect récent.
                      </td>
                    </tr>
                  )}
                  {data?.recentProspects?.map((prospect) => (
                    <tr key={prospect.id} className="border-b last:border-0">
                      <td className="py-2">
                        <Link className="font-medium hover:underline" href={`/prospects/${prospect.id}`}>
                          {prospect.companyName}
                        </Link>
                      </td>
                      <td className="py-2 text-muted-foreground">{prospect.city || "-"}</td>
                      <td className="py-2">
                        <Badge className={getStatusColor(prospect.status)}>{getStatusLabel(prospect.status)}</Badge>
                      </td>
                      <td className="py-2">{prospect.score}</td>
                      <td className="py-2 text-muted-foreground">{formatDate(prospect.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Priorités</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4, 5].map((priority) => (
              <div key={priority} className="flex items-center justify-between text-sm">
                <Badge className={getPriorityColor(priority)}>{getPriorityLabel(priority)}</Badge>
                <span className="font-medium">
                  {isLoading ? "..." : data?.priorityCounts?.[priority] ?? 0}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Répartition par statut</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Chargement...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Priorités actives</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Chargement...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={3}>
                    {priorityData.map((entry, index) => (
                      <Cell key={entry.name} fill={priorityColors[index % priorityColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Relances à venir (7 jours)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <div className="text-sm text-muted-foreground">Chargement...</div>}
            {!isLoading && data?.upcomingFollowUps?.length === 0 && (
              <div className="text-sm text-muted-foreground">Aucune relance planifiée.</div>
            )}
            {data?.upcomingFollowUps?.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0">
                <div>
                  <Link className="font-medium hover:underline" href={`/prospects/${item.id}`}>
                    {item.companyName}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {item.assignedTo?.name ? `Assigné à ${item.assignedTo.name}` : "Non assigné"}
                  </div>
                  {item.followUpNote && <div className="text-xs text-muted-foreground">{item.followUpNote}</div>}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <Badge className={getStatusColor(item.status)}>{getStatusLabel(item.status)}</Badge>
                  <div className="mt-1">{formatDateTime(item.nextFollowUpAt)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activités récentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <div className="text-sm text-muted-foreground">Chargement...</div>}
            {!isLoading && data?.recentActivities?.length === 0 && (
              <div className="text-sm text-muted-foreground">Aucune activité récente.</div>
            )}
            {data?.recentActivities?.map((activity) => (
              <div key={activity.id} className="border-b pb-3 last:border-0">
                <div className="flex items-center justify-between">
                  <Link className="font-medium hover:underline" href={`/prospects/${activity.prospect.id}`}>
                    {activity.prospect.companyName}
                  </Link>
                  <span className="text-xs text-muted-foreground">{formatDateTime(activity.createdAt)}</span>
                </div>
                <div className="text-sm">{activity.title}</div>
                <div className="text-xs text-muted-foreground">{activity.user.name}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
