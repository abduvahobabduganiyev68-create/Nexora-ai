export type ModelProvider = "OpenRouter";

export interface AIModel {
  id: string;
  name: string;
  provider: ModelProvider;
  description: string;
  contextWindow: number;
  capabilities: string[];
  streaming: boolean;
  available: boolean;
}

export const MODEL_REGISTRY: AIModel[] = [
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o mini",
    provider: "OpenRouter",
    description: "Fast, capable general-purpose model",
    contextWindow: 128000,
    capabilities: ["Chat", "Code", "Vision"],
    streaming: true,
    available: true,
  },
  {
    id: "anthropic/claude-3.5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "OpenRouter",
    description: "Fast model optimized for concise responses",
    contextWindow: 200000,
    capabilities: ["Chat", "Code"],
    streaming: true,
    available: true,
  },
  {
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    provider: "OpenRouter",
    description: "Low-latency multimodal model",
    contextWindow: 1048576,
    capabilities: ["Chat", "Code", "Vision"],
    streaming: true,
    available: true,
  },
];
