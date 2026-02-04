"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/lib/use-toast";
import { getStatusColor, getStatusLabel, getPriorityColor, getPriorityLabel } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const PIPELINE_COLUMNS = [
  "A_CONTACTER",
  "CONTACTE",
  "INTERESSE",
  "A_RELANCER",
  "CLIENT",
] as const;

type ProspectCard = {
  id: string;
  companyName: string;
  status: string;
  score: number;
  priority: number;
  city: string | null;
  assignedTo?: { name: string } | null;
};

function SortableCard({ prospect }: { prospect: ProspectCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: prospect.id,
    data: { status: prospect.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ProspectCardView prospect={prospect} />
    </div>
  );
}

function ProspectCardView({ prospect }: { prospect: ProspectCard }) {
  return (
    <Card className="cursor-grab p-3 hover:shadow-md active:cursor-grabbing">
      <div className="space-y-1.5">
        <Link
          href={`/prospects/${prospect.id}`}
          className="text-sm font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {prospect.companyName}
        </Link>
        <div className="flex items-center gap-1.5">
          <Badge className={`${getPriorityColor(prospect.priority)} text-[10px] px-1.5 py-0`}>
            {getPriorityLabel(prospect.priority)}
          </Badge>
          <span className="text-[11px] text-muted-foreground">Score {prospect.score}</span>
        </div>
        {prospect.city && (
          <div className="text-[11px] text-muted-foreground">{prospect.city}</div>
        )}
        {prospect.assignedTo && (
          <div className="text-[11px] text-muted-foreground">{prospect.assignedTo.name}</div>
        )}
      </div>
    </Card>
  );
}

function DroppableColumn({
  status,
  prospects,
  count,
}: {
  status: string;
  prospects: ProspectCard[];
  count: number;
}) {
  return (
    <div className="flex w-72 flex-shrink-0 flex-col rounded-lg bg-muted/50 border">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(status)}>{getStatusLabel(status)}</Badge>
          <span className="text-xs text-muted-foreground">{count}</span>
        </div>
      </div>
      <ScrollArea className="flex-1 p-2">
        <SortableContext items={prospects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[100px]">
            {prospects.map((prospect) => (
              <SortableCard key={prospect.id} prospect={prospect} />
            ))}
            {prospects.length === 0 && (
              <div className="flex h-20 items-center justify-center text-xs text-muted-foreground">
                Aucun prospect
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

export default function PipelinePage() {
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data, mutate } = useSWR(
    "/api/prospects?limit=200&sortBy=score&sortOrder=desc",
    fetcher,
    { refreshInterval: 30000 }
  );

  const allProspects: ProspectCard[] = data?.prospects || [];

  const columnData = useMemo(() => {
    const map: Record<string, ProspectCard[]> = {};
    for (const col of PIPELINE_COLUMNS) {
      map[col] = allProspects.filter((p) => p.status === col);
    }
    return map;
  }, [allProspects]);

  const activeProspect = activeId ? allProspects.find((p) => p.id === activeId) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;

      if (!over) return;

      const prospectId = String(active.id);
      const prospect = allProspects.find((p) => p.id === prospectId);
      if (!prospect) return;

      // Determine target status from over.id or over.data
      let targetStatus: string | undefined;

      // Check if dropped on a column (over.id matches a status)
      if (PIPELINE_COLUMNS.includes(over.id as typeof PIPELINE_COLUMNS[number])) {
        targetStatus = String(over.id);
      } else {
        // Dropped on another card, find its status
        const overProspect = allProspects.find((p) => p.id === String(over.id));
        if (overProspect) {
          targetStatus = overProspect.status;
        }
      }

      if (!targetStatus || targetStatus === prospect.status) return;

      // Optimistic update
      mutate(
        {
          ...data,
          prospects: allProspects.map((p) =>
            p.id === prospectId ? { ...p, status: targetStatus } : p
          ),
        },
        false
      );

      try {
        const res = await fetch(`/api/prospects/${prospectId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          toast({
            title: "Transition impossible",
            description: json.error || "Erreur",
            variant: "destructive",
          });
          mutate(); // Revert
        } else {
          toast({
            title: "Statut mis à jour",
            description: `${prospect.companyName} → ${getStatusLabel(targetStatus)}`,
            variant: "success",
          });
          mutate();
        }
      } catch {
        mutate(); // Revert on network error
      }
    },
    [allProspects, data, mutate, toast]
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Glissez les prospects entre les colonnes pour changer leur statut.
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "calc(100vh - 200px)" }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {PIPELINE_COLUMNS.map((status) => (
            <DroppableColumn
              key={status}
              status={status}
              prospects={columnData[status] || []}
              count={(columnData[status] || []).length}
            />
          ))}
          <DragOverlay>
            {activeProspect ? <ProspectCardView prospect={activeProspect} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
