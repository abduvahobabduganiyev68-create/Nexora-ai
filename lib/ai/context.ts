export interface ContextMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function buildModelContext(
  messages: ContextMessage[],
  systemContext?: string,
  maxMessages = 40,
) {
  const recent = messages.slice(-maxMessages);
  const system: ContextMessage[] = systemContext
    ? [{ role: "system", content: systemContext }]
    : [];
  return [...system, ...recent];
}
