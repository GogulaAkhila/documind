import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { PanelRightClose, PanelRightOpen, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { SourcesPanel } from "@/components/chat/sources-panel";
import { useChatStore } from "@/stores/chat-store";
import { cn } from "@/lib/utils";

export function ChatPage() {
  const { id: collectionId, sessionId } = useParams<{
    id: string;
    sessionId: string;
  }>();
  const [showSources, setShowSources] = useState(true);
  const [showHistory, setShowHistory] = useState(true);
  const activeSources = useChatStore((s) => s.activeSources);

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No chat session selected</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Chat history sidebar */}
      {showHistory && collectionId && (
        <ChatSidebar
          collectionId={collectionId}
          activeSessionId={sessionId}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Chat header */}
        <div className="flex h-11 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            {!showHistory && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowHistory(true)}
              >
                <PanelRightOpen className="h-4 w-4 rotate-180" />
              </Button>
            )}
            {collectionId && (
              <Link
                to={`/collections/${collectionId}`}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to collection
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              gemini-2.5-flash
            </span>
            {activeSources.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowSources(!showSources)}
              >
                {showSources ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRightOpen className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        <ChatInterface sessionId={sessionId} />
      </div>

      {/* Sources sidebar */}
      {showSources && activeSources.length > 0 && (
        <SourcesPanel
          sources={activeSources}
          onClose={() => setShowSources(false)}
        />
      )}
    </div>
  );
}
