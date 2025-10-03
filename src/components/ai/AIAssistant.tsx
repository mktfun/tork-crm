import { useState, useRef, useEffect } from 'react';
import { Send, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const QUICK_QUESTIONS = [
  "Quais apólices vencem este mês?",
  "Mostre o resumo financeiro.",
  "Liste meus clientes inativos.",
  "Crie um agendamento com João Silva.",
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (prompt?: string) => {
    const messageContent = prompt || input;
    if (!messageContent.trim() || isLoading || !user) return;

    // Se for um prompt sugerido, atualiza o input visualmente antes de enviar
    if (prompt) setInput(prompt);

    const userMessage: Message = {
      role: 'user',
      content: messageContent.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          userId: user.id
        }
      });

      if (error) throw error;

      // Simular typing por um breve momento
      setTimeout(() => {
        setIsTyping(false);
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.message
        };
        setMessages(prev => [...prev, assistantMessage]);
      }, 500);

    } catch (error) {
      console.error('Error calling AI assistant:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível processar sua mensagem. Tente novamente.',
        variant: 'destructive'
      });

      // Remove a mensagem do usuário em caso de erro
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    sendMessage(question);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="flex flex-col h-[70vh] w-full border-none">
      <CardHeader className="flex flex-row items-center gap-2 border-b bg-gradient-to-r from-purple-600/10 to-blue-600/10">
        <div className="p-1.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <CardTitle>Assistente Virtual</CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full p-4" ref={scrollRef}>
          {messages.length === 0 && !isLoading && (
            <div className="text-center text-muted-foreground mt-8">
              <Sparkles className="mx-auto h-12 w-12 mb-4 text-purple-600" />
              <p className="font-medium mb-6 text-lg">Como posso te ajudar hoje?</p>
              <div className="grid grid-cols-1 gap-2 text-sm">
                {QUICK_QUESTIONS.map((prompt) => (
                  <Button
                    key={prompt}
                    variant="outline"
                    className="h-auto text-wrap justify-start p-3"
                    onClick={() => handleQuickQuestion(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                } animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-purple-600/20 to-blue-600/20 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                  </div>
                )}
                <div
                  className={`rounded-lg px-4 py-2 max-w-[80%] ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            
            {isTyping && (
              <div className="flex gap-3 justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-purple-600/20 to-blue-600/20 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                </div>
                <div className="rounded-lg px-4 py-2 bg-muted flex items-center gap-1">
                  <span className="h-2 w-2 bg-purple-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="h-2 w-2 bg-purple-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="h-2 w-2 bg-purple-600 rounded-full animate-bounce"></span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      
      <CardFooter className="p-4 border-t flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Pergunte algo..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button onClick={() => sendMessage()} disabled={isLoading || !input.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
