import { Link } from "react-router-dom";
import { BookOpen, FileText, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Collection } from "@/types";

interface CollectionCardProps {
  collection: Collection;
  onDelete: (id: string) => void;
}

export function CollectionCard({ collection, onDelete }: CollectionCardProps) {
  return (
    <Link to={`/collections/${collection.id}`} className="group block">
      <Card className="transition-all hover:shadow-md hover:border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{collection.name}</CardTitle>
                <CardDescription className="text-xs">
                  {new Date(collection.created_at).toLocaleDateString()}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(collection.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {collection.description && (
            <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
              {collection.description}
            </p>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span>
              {collection.document_count}{" "}
              {collection.document_count === 1 ? "document" : "documents"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
