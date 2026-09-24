import { Router } from "express";

export const realtimeRouter = Router();

realtimeRouter.get("/", (_request, response) => {
  response.status(200);
  response.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  response.flushHeaders();
  response.write(": connected\n\n");

  const heartbeat = setInterval(() => {
    response.write(": heartbeat\n\n");
  }, 25_000);

  response.on("close", () => {
    clearInterval(heartbeat);
  });
});
