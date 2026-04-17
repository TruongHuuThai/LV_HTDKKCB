import { useState } from 'react';
import { Bot, LoaderCircle, MessageCircle, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { aiAssistantApi } from '@/services/api/aiAssistantApi';
import { useAuthStore } from '@/store/useAuthStore';

type UiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  sources?: Array<{ title: string; category: string; source: string }>;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const INIT_MESSAGE: UiMessage = {
  id: 'assistant-init',
  role: 'assistant',
  createdAt: new Date().toISOString(),
  content:
    'Xin chào, tôi là trợ lý đặt lịch AI.\nBạn có thể hỏi về lịch khám, khung giờ trống, thanh toán QR và chính sách hủy/đổi lịch.',
};

export default function PatientAiChatbox() {
  const user = useAuthStore((state) => state.user);
  const isPatient = user?.TK_VAI_TRO === 'BENH_NHAN';

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([INIT_MESSAGE]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: UiMessage = {
      id: makeId(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    if (!isPatient) {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          content:
            'Vui long dang nhap tai khoan benh nhan de tro ly co the truy xuat lich ca nhan an toan.\nPlease sign in as a patient account first.',
          createdAt: new Date().toISOString(),
        },
      ]);
      return;
    }

    setLoading(true);
    try {
      const history = messages
        .slice(-8)
        .filter((item) => item.role === 'user' || item.role === 'assistant')
        .map((item) => ({
          role: item.role,
          content: item.content,
        }));

      const response = await aiAssistantApi.chat({
        message: text,
        history,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          content: response.answer,
          createdAt: response.generatedAt || new Date().toISOString(),
          sources: response.sources,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          content:
            'He thong AI tam thoi ban. Ban vui long thu lai sau it phut.\nAI service is temporarily unavailable. Please try again shortly.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[80]">
      {open ? (
        <div className="w-[min(92vw,390px)] rounded-2xl border border-blue-100 bg-white shadow-2xl shadow-blue-300/25">
          <div className="flex items-center justify-between border-b border-blue-100 bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-white/20 p-1.5">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">AI tư vấn đặt lịch</p>
                {/* <p className="text-[11px] opacity-90">Read-only | Bảo vệ dữ liệu nhạy cảm</p> */}
              </div>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-white hover:bg-white/20 hover:text-white"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-[48vh] space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'ml-9 bg-blue-600 text-white'
                    : 'mr-9 border border-blue-100 bg-blue-50 text-slate-800'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                {message.sources && message.sources.length > 0 ? (
                  <p className="mt-2 text-[11px] text-slate-500">
                    Nguon: {message.sources.slice(0, 2).map((item) => item.title).join(' | ')}
                  </p>
                ) : null}
              </div>
            ))}

            {loading ? (
              <div className="mr-9 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-slate-700">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Dang phan tich du lieu...
              </div>
            ) : null}
          </div>

          <div className="border-t border-blue-100 px-3 py-3">
            <div className="space-y-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Hoi ve lich bac si, khung gio trong, quy trinh dat lich..."
                className="min-h-[80px] resize-none"
              />
              <Button
                type="button"
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                disabled={loading || !input.trim()}
                onClick={sendMessage}
              >
                <Send className="h-4 w-4" />
                Gui cau hoi
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="h-12 rounded-full bg-blue-600 px-4 shadow-lg shadow-blue-500/35 hover:bg-blue-700"
        >
          <MessageCircle className="mr-2 h-5 w-5" />
          AI Dat Lich
        </Button>
      )}
    </div>
  );
}
