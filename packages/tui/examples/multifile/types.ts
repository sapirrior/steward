export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  tokens?: number;
}

export interface ChatSessionState {
  model: string;
  temperature: number;
  isStreaming: boolean;
}
