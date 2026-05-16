import { useParams } from "react-router-dom";
import { ChatInterface } from "@/components/chat/chat-interface";

export function ChatPage() {
  const { sessionId } = useParams<{ id: string; sessionId: string }>();

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No chat session selected</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <ChatInterface sessionId={sessionId} />
    </div>
  );
}
