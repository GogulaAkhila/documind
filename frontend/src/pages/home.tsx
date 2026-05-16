import { useState } from "react";
import { BookOpen, FileText, MessageSquare, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CollectionList } from "@/components/collections/collection-list";
import { CreateCollectionDialog } from "@/components/collections/create-collection-dialog";
import { useCollections } from "@/hooks/use-collections";

export function Home() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: collections } = useCollections();

  const stats = [
    {
      label: "Collections",
      value: collections?.length ?? 0,
      icon: BookOpen,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Documents",
      value: collections?.reduce((sum, c) => sum + c.document_count, 0) ?? 0,
      icon: FileText,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Chat",
      value: "Ready",
      icon: MessageSquare,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      label: "Evaluation",
      value: "Available",
      icon: BarChart3,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Welcome to DocuMind</h1>
        <p className="mt-1 text-muted-foreground">
          Upload research papers, ask questions, and get cited answers powered by
          RAG.
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}
              >
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Your Collections</h2>
        <Button onClick={() => setCreateOpen(true)}>
          <BookOpen className="mr-2 h-4 w-4" />
          New Collection
        </Button>
      </div>

      <CollectionList onCreateCollection={() => setCreateOpen(true)} />

      <CreateCollectionDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
