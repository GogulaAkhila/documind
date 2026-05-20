import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, X, Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatSessions, useCreateChatSession } from "@/hooks/use-chat";
import { useCollection } from "@/hooks/use-collections";
import { cn } from "@/lib/utils";
import type { ChatSession } from "@/types";

interface ChatSidebarProps {
  collectionId: string;
  activeSessionId: string;
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000,
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function groupByDate(sessions: ChatSession[]): { label: string; items: ChatSession[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: ChatSession[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const session of sessions) {
    const created = new Date(session.created_at);
    if (created >= today) groups[0].items.push(session);
    else if (created >= yesterday) groups[1].items.push(session);
    else if (created >= weekAgo) groups[2].items.push(session);
    else groups[3].items.push(session);
  }

  return groups.filter((g) => g.items.length > 0);
}

export function ChatSidebar({
  collectionId,
  activeSessionId,
  onClose,
}: ChatSidebarProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: sessions } = useChatSessions(collectionId);
  const { data: collection } = useCollection(collectionId);
  const createSession = useCreateChatSession(collectionId);

  const filtered = sessions?.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase()),
  );

  const groups = groupByDate(filtered ?? []);

  return (
    <div className="flex w-60 shrink-0 flex-col border-r bg-muted/20">
      <div className="flex h-11 items-center justify-between border-b px-3">
        <span className="text-xs font-semibold">Chat history</span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() =>
              createSession.mutate(undefined, {
                onSuccess: (s) => {
                  navigate(`/collections/${collectionId}/chat/${s.id}`);
                },
              })
            }
            disabled={createSession.isPending}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="border-b px-2 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((session) => (
                <Link
                  key={session.id}
                  to={`/collections/${collectionId}/chat/${session.id}`}
                  className={cn(
                    "flex flex-col rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent",
                    session.id === activeSessionId &&
                      "border-l-2 border-l-primary bg-primary/5",
                  )}
                >
                  <span className="truncate text-xs font-medium">
                    {session.title}
                  </span>
                  <span className="mt-0.5 text-[10px] text-muted-foreground">
                    {timeAgo(session.created_at)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {filtered?.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {search ? "No matching chats" : "No chats yet"}
          </p>
        )}
      </div>

      <div className="border-t p-2.5">
        <Link
          to={`/collections/${collectionId}`}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          <span className="truncate">{collection?.name ?? "Back"}</span>
        </Link>
      </div>
    </div>
  );
}
