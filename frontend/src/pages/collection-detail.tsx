import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  MessageSquare,
  Plus,
  Upload,
  FileText,
  SendHorizonal,
  Clock,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList } from "@/components/documents/document-list";
import { useCollection } from "@/hooks/use-collections";
import { useDocuments } from "@/hooks/use-documents";
import {
  useChatSessions,
  useCreateChatSession,
  useDeleteChatSession,
} from "@/hooks/use-chat";
import { cn } from "@/lib/utils";

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

export function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: collection, isLoading } = useCollection(id!);
  const { data: sessions } = useChatSessions(id!);
  const { data: documents } = useDocuments(id!);
  const createSession = useCreateChatSession(id!);
  const deleteSession = useDeleteChatSession(id!);
  const [quickAsk, setQuickAsk] = useState("");
  const [quickAskLoading, setQuickAskLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [docFilter, setDocFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const handleNewChat = () => {
    createSession.mutate(undefined, {
      onSuccess: (session) => {
        navigate(`/collections/${id}/chat/${session.id}`);
      },
    });
  };

  const handleQuickAsk = async () => {
    const question = quickAsk.trim();
    if (!question) return;
    setQuickAskLoading(true);
    try {
      const session = await createSession.mutateAsync(question);
      navigate(`/collections/${id}/chat/${session.id}`, {
        state: { initialMessage: question },
      });
    } catch {
      setQuickAskLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-6 lg:grid-cols-2 mt-6">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Collection not found</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {collection.name}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {collection.document_count}{" "}
              {collection.document_count === 1 ? "document" : "documents"}
              {sessions && sessions.length > 0 && (
                <>
                  {" "}&middot; {sessions.length}{" "}
                  {sessions.length === 1 ? "chat" : "chats"}
                </>
              )}
              {" "}&middot; Updated{" "}
              {timeAgo(
                documents?.length
                  ? documents.reduce((latest, d) =>
                      d.uploaded_at > latest ? d.uploaded_at : latest,
                    documents[0].uploaded_at)
                  : collection.created_at,
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleNewChat}
            disabled={createSession.isPending}
          >
            <MessageSquare className="mr-1.5 h-4 w-4" />
            {createSession.isPending ? "Creating..." : "New chat"}
          </Button>
        </div>
      </div>

      {/* Side-by-side panels */}
      <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Documents panel */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Documents</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUpload(!showUpload)}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Upload
            </Button>
          </div>

          {showUpload && (
            <div className="mb-4">
              <DocumentUpload collectionId={id!} />
            </div>
          )}

          <div className="mb-3">
            <Input
              placeholder="Filter documents..."
              value={docFilter}
              onChange={(e) => setDocFilter(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <ScrollArea className="max-h-[400px]">
            <DocumentList collectionId={id!} filter={docFilter} />
          </ScrollArea>
        </div>

        {/* Chats panel */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-semibold">Chats</h2>

          {sessions && sessions.length > 0 ? (
            <div className="space-y-1">
              {sessions.map((session, i) => (
                <div
                  key={session.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-lg transition-colors hover:bg-accent",
                    i === 0 && "border-l-3 border-l-primary bg-primary/5",
                  )}
                >
                  <Link
                    to={`/collections/${id}/chat/${session.id}`}
                    className="flex-1 min-w-0 px-3 py-2.5"
                  >
                    <p className="text-sm font-medium leading-snug truncate">
                      {session.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {timeAgo(session.created_at)}
                    </p>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mr-1 h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() =>
                      setDeleteTarget({ id: session.id, title: session.title })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No chats yet. Start by asking a question below.
              </p>
            </div>
          )}

          {/* Quick Ask */}
          <div className="mt-4 flex items-center gap-2 rounded-lg border-2 border-dashed border-border p-2 transition-colors focus-within:border-primary/30">
            <Input
              placeholder="Quick ask: type a question or start a new chat..."
              value={quickAsk}
              onChange={(e) => setQuickAsk(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleQuickAsk();
                }
              }}
              className="h-8 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
              disabled={quickAskLoading}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
              onClick={handleQuickAsk}
              disabled={!quickAsk.trim() || quickAskLoading}
            >
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Delete chat confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete chat"
        description={`This will permanently delete "${deleteTarget?.title ?? ""}" and all its messages. This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleteTarget) deleteSession.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
