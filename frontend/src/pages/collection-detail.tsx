import { useParams, useNavigate } from "react-router-dom";
import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList } from "@/components/documents/document-list";
import { useCollection } from "@/hooks/use-collections";
import { useChatSessions, useCreateChatSession } from "@/hooks/use-chat";

export function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: collection, isLoading } = useCollection(id!);
  const { data: sessions } = useChatSessions(id!);
  const createSession = useCreateChatSession(id!);

  const handleNewChat = () => {
    createSession.mutate(undefined, {
      onSuccess: (session) => {
        navigate(`/collections/${id}/chat/${session.id}`);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-40 w-full" />
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
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{collection.name}</h1>
          {collection.description && (
            <p className="mt-1 text-muted-foreground">{collection.description}</p>
          )}
        </div>
        <Button onClick={handleNewChat} disabled={createSession.isPending}>
          <MessageSquare className="mr-2 h-4 w-4" />
          {createSession.isPending ? "Creating..." : "New Chat"}
        </Button>
      </div>

      <div className="space-y-6">
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Upload Documents
          </h2>
          <DocumentUpload collectionId={id!} />
        </section>

        <Separator />

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Documents ({collection.document_count})
          </h2>
          <DocumentList collectionId={id!} />
        </section>

        {sessions && sessions.length > 0 && (
          <>
            <Separator />
            <section>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Recent Chats
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {sessions.slice(0, 6).map((session) => (
                  <Button
                    key={session.id}
                    variant="outline"
                    className="h-auto justify-start gap-2 p-3"
                    onClick={() =>
                      navigate(`/collections/${id}/chat/${session.id}`)
                    }
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 text-left">
                      <p className="truncate text-sm">{session.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(session.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  className="h-auto justify-center gap-2 border border-dashed p-3"
                  onClick={handleNewChat}
                >
                  <Plus className="h-4 w-4" />
                  New Chat
                </Button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
