import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CollectionCard } from "./collection-card";
import { useCollections, useDeleteCollection } from "@/hooks/use-collections";

interface CollectionListProps {
  onCreateCollection: () => void;
}

export function CollectionList({ onCreateCollection }: CollectionListProps) {
  const { data: collections, isLoading } = useCollections();
  const deleteCollection = useDeleteCollection();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
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
          Create your first collection to start uploading research papers and
          asking questions.
        </p>
        <Button onClick={onCreateCollection}>Create Collection</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {collections.map((collection) => (
        <CollectionCard
          key={collection.id}
          collection={collection}
          onDelete={(id) => deleteCollection.mutate(id)}
        />
      ))}
    </div>
  );
}
