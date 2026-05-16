import type { WebSocketMessage, Citation } from "@/types";

type MessageHandler = (msg: WebSocketMessage) => void;
type StatusHandler = (connected: boolean) => void;

const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_DELAY_MS = 1_000;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;
  private onMessage: MessageHandler;
  private onStatusChange: StatusHandler;

  constructor(url: string, onMessage: MessageHandler, onStatusChange: StatusHandler) {
    this.url = url;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  connect(): void {
    this.intentionallyClosed = false;
    this.cleanup();

    const wsBase = import.meta.env.VITE_WS_URL || "ws://localhost:8000";
    this.ws = new WebSocket(`${wsBase}${this.url}`);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.onStatusChange(true);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data as string) as WebSocketMessage;
        this.onMessage(parsed);
      } catch {
        this.onMessage({ type: "error", data: null, error: "Failed to parse message" });
      }
    };

    this.ws.onclose = () => {
      this.onStatusChange(false);
      if (!this.intentionallyClosed) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    this.intentionallyClosed = true;
    this.cleanup();
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  static parseSourcesFromMessage(data: unknown): Citation[] {
    if (Array.isArray(data)) {
      return data as Citation[];
    }
    return [];
  }
}
