import { useState } from "react";
import { Plus, Search, FileText, MessageSquare, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CollectionList } from "@/components/collections/collection-list";
import { CreateCollectionDialog } from "@/components/collections/create-collection-dialog";
import { useCollections } from "@/hooks/use-collections";

export function Home() {
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: collections } = useCollections();

  const totalDocs = collections?.reduce((sum, c) => sum + c.document_count, 0) ?? 0;
  const totalCollections = collections?.length ?? 0;

  const filtered = collections?.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your collections</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <FolderOpen className="h-3.5 w-3.5" />
              {totalCollections} {totalCollections === 1 ? "collection" : "collections"}
            </span>
            <span>&middot;</span>
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {totalDocs} {totalDocs === 1 ? "document" : "documents"}
            </span>
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New collection
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search collections..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 sm:max-w-sm"
        />
      </div>

      <CollectionList
        collections={filtered}
        onCreateCollection={() => setCreateOpen(true)}
      />

      <CreateCollectionDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
