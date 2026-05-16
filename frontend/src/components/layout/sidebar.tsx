import { Link, useParams } from "react-router-dom";
import { BookOpen, Plus, Home, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
      <div className="flex items-center gap-2 px-4 py-5">
        <BookOpen className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold tracking-tight">DocuMind</span>
      </div>

      <Separator />

      <div className="px-3 py-2">
        <Link to="/">
          <Button variant="ghost" className="w-full justify-start gap-2">
            <Home className="h-4 w-4" />
            Home
          </Button>
        </Link>
      </div>

      <Separator />

      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Collections
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onCreateCollection}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : collections?.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            No collections yet
          </p>
        ) : (
          <div className="space-y-1">
            {collections?.map((collection) => (
              <Link key={collection.id} to={`/collections/${collection.id}`}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-2 text-left",
                    activeCollectionId === collection.id && "bg-accent",
                  )}
                >
                  <BookOpen className="h-4 w-4 shrink-0" />
                  <span className="truncate">{collection.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {collection.document_count}
                  </span>
                </Button>
              </Link>
            ))}
          </div>
        )}
      </ScrollArea>

      <Separator />
      <div className="p-3">
        <Link to={activeCollectionId ? `/collections/${activeCollectionId}/evaluation` : "#"}>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
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
