import { BookOpen, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CollectionCard } from "./collection-card";
import { useCollections, useDeleteCollection } from "@/hooks/use-collections";
import type { Collection } from "@/types";

interface CollectionListProps {
  collections?: Collection[];
  onCreateCollection: () => void;
}

export function CollectionList({
  collections: passedCollections,
  onCreateCollection,
}: CollectionListProps) {
  const { data: fetchedCollections, isLoading } = useCollections();
  const deleteCollection = useDeleteCollection();
  const collections = passedCollections ?? fetchedCollections;

  if (isLoading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!collections?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <BookOpen className="h-8 w-8 text-primary" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">No collections yet</h3>
        <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
          Create your first collection to start uploading documents and asking
          questions.
        </p>
        <button
          onClick={onCreateCollection}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create Collection
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {collections.map((collection) => (
        <CollectionCard
          key={collection.id}
          collection={collection}
          onDelete={(id) => deleteCollection.mutate(id)}
        />
      ))}
      <button
        onClick={onCreateCollection}
        className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-foreground"
      >
        <Plus className="h-6 w-6" />
        <span className="text-sm font-medium">Create new collection</span>
      </button>
    </div>
  );
}
