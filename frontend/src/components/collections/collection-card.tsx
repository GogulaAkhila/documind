import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  FileText,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Collection } from "@/types";

const ICON_THEMES = [
  { bg: "bg-info-bg", text: "text-info-text" },
  { bg: "bg-success-bg", text: "text-success-text" },
  { bg: "bg-warning-bg", text: "text-warning-text" },
  { bg: "bg-[#F3E8FF]", text: "text-[#6B21A8]" },
  { bg: "bg-[#E0F2FE]", text: "text-[#0369A1]" },
  { bg: "bg-[#FFF1F2]", text: "text-[#BE123C]" },
];

function getIconTheme(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return ICON_THEMES[Math.abs(hash) % ICON_THEMES.length];
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

interface CollectionCardProps {
  collection: Collection;
  onDelete: (id: string) => void;
}

export function CollectionCard({ collection, onDelete }: CollectionCardProps) {
  const theme = getIconTheme(collection.id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <Link to={`/collections/${collection.id}`} className="group block">
        <div className="flex h-full flex-col rounded-xl bg-card p-5 transition-all duration-200 hover:bg-accent hover:-translate-y-0.5">
          <div className="mb-4 flex items-start justify-between">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${theme.bg}`}
            >
              <BookOpen className={`h-5 w-5 ${theme.text}`} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => e.preventDefault()}
                >
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.preventDefault()}
              >
                <DropdownMenuItem disabled>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    setConfirmDelete(true);
                  }}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <h3 className="mb-1 font-semibold leading-snug">{collection.name}</h3>
          {collection.description && (
            <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
              {collection.description}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between pt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {collection.document_count} docs
              </span>
              {(collection as any).chat_count != null && (
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {(collection as any).chat_count} chats
                </span>
              )}
            </div>
            <span>{timeAgo(collection.created_at)}</span>
          </div>
        </div>
      </Link>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete collection"
        description={`This will permanently delete "${collection.name}" and all its documents and chats. This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => onDelete(collection.id)}
      />
    </>
  );
}
