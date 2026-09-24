import { SseEnvelopeSchema, type SseEnvelope } from "@surplus/shared";

export function connectToEventStream(onEvent: (event: SseEnvelope) => void): () => void {
  const source = new EventSource("/api/events");
  source.onmessage = (message) => {
    try {
      onEvent(SseEnvelopeSchema.parse(JSON.parse(message.data)));
    } catch (error) {
      console.error("Received an invalid server event", error);
    }
  };
  source.onerror = () => {
    // EventSource retries automatically; callers can display connection state if needed.
  };
  return () => source.close();
}
