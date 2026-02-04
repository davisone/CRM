"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Notification = {
  id: string;
  type: string;
  title: string;
  description: string;
  link?: string;
  createdAt: string;
};

export function Header() {
  const { data: session } = useSession();
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");

  const { data: notifData } = useSWR("/api/notifications", fetcher, {
    refreshInterval: 60000,
  });

  const notifications: Notification[] = notifData?.notifications || [];
  const unreadCount: number = notifData?.unreadCount || 0;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/prospects?search=${encodeURIComponent(searchValue.trim())}`);
    }
  }

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-card px-6">
      <div className="flex-1">
        <form onSubmit={handleSearch} className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher un prospect..."
            className="pl-9"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </form>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {notifications.length === 0 && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              Aucune notification
            </div>
          )}
          {notifications.slice(0, 8).map((notif) => (
            <DropdownMenuItem
              key={notif.id}
              className="flex flex-col items-start gap-1 cursor-pointer"
              onClick={() => notif.link && router.push(notif.link)}
            >
              <span className="text-sm font-medium">{notif.title}</span>
              <span className="text-xs text-muted-foreground line-clamp-1">
                {notif.description}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="text-sm text-muted-foreground">
        {session?.user?.name}
      </span>
    </header>
  );
}
