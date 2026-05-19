import { Link } from "react-router-dom";
import { Plus, X, MessageSquare, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatSessions, useCreateChatSession } from "@/hooks/use-chat";
import { useCollection } from "@/hooks/use-collections";
import { cn } from "@/lib/utils";

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

export function ChatSidebar({
  collectionId,
  activeSessionId,
  onClose,
}: ChatSidebarProps) {
  const { data: sessions } = useChatSessions(collectionId);
  const { data: collection } = useCollection(collectionId);
  const createSession = useCreateChatSession(collectionId);

  return (
    <div className="flex w-56 shrink-0 flex-col border-r bg-muted/30">
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
                  window.location.href = `/collections/${collectionId}/chat/${s.id}`;
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

      <ScrollArea className="flex-1 p-2">
        <div className="space-y-0.5">
          {sessions?.map((session) => (
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
      </ScrollArea>

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
