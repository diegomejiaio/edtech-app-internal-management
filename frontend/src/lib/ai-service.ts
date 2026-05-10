// AI service stub — decouples ChatBubble from the (not yet available) BFF endpoint.
// Replace the implementation when the backend AI endpoint is ready.

/**
 * Send a message to the AI assistant and return its reply.
 *
 * TODO: conectar al endpoint real de AI cuando esté disponible en el BFF.
 *       Endpoint esperado: POST /api/v1/ai/chat  { message: string }
 *       Response: { reply: string }
 */
export async function sendMessage(_text: string): Promise<string> {
  // Stub: the backend endpoint does not exist yet.
  throw new Error("AI endpoint not yet implemented");
}
