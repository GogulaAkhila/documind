import { Link, useParams } from "react-router-dom";
import { BookOpen, Plus, Home, BarChart3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollections } from "@/hooks/use-collections";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onCreateCollection: () => void;
}

export function Sidebar({ onCreateCollection }: SidebarProps) {
  const { id: activeCollectionId } = useParams();
  const { data: collections, isLoading } = useCollections();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Link to="/" className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <FileText className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-semibold tracking-tight">DocuMind</span>
      </Link>

      <div className="px-3 pb-1">
        <Link to="/">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-2 font-medium",
              !activeCollectionId && "bg-sidebar-accent",
            )}
          >
            <Home className="h-4 w-4" />
            Home
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Collections
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={onCreateCollection}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3">
        {isLoading ? (
          <div className="space-y-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        ) : collections?.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            No collections yet
          </p>
        ) : (
          <div className="space-y-0.5">
            {collections?.map((collection) => (
              <Link key={collection.id} to={`/collections/${collection.id}`}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-2 text-left font-normal",
                    activeCollectionId === collection.id &&
                      "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                  )}
                >
                  <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{collection.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {collection.document_count}
                  </span>
                </Button>
              </Link>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="border-t p-3">
        <Link
          to={
            activeCollectionId
              ? `/collections/${activeCollectionId}/evaluation`
              : "#"
          }
        >
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 font-normal"
            disabled={!activeCollectionId}
          >
            <BarChart3 className="h-4 w-4" />
            Evaluation
          </Button>
        </Link>
      </div>
    </div>
  );
}
