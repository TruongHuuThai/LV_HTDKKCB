import axiosClient from './axiosClient';

export type AiAssistantHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

export type AiAssistantChatRequest = {
  message: string;
  locale?: 'vi' | 'en';
  history?: AiAssistantHistoryItem[];
};

export type AiAssistantChatResponse = {
  answer: string;
  locale: 'vi' | 'en';
  generatedAt: string;
  sources: Array<{
    title: string;
    category: string;
    source: string;
  }>;
  policy: {
    mode: 'READ_ONLY';
    allowedDomains: string[];
    maskedColumns: string[];
  };
};

export const aiAssistantApi = {
  chat: async (data: AiAssistantChatRequest) => {
    const res = await axiosClient.post<AiAssistantChatResponse>('/ai-assistant/chat', data);
    return res.data;
  },
};

