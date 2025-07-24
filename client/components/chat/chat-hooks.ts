import { useMutation, useSubscription } from '@apollo/client';
import { CHAT_MUTATION, CHAT_STREAM_SUBSCRIPTION } from '@/lib/graphql/queries';
import { useState } from 'react';

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

export function useChatWithWebSocket(sessionId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [sendMessage] = useMutation(CHAT_MUTATION);

  const { data: subscriptionData } = useSubscription(CHAT_STREAM_SUBSCRIPTION, {
    variables: { sessionId },
    onData: ({ data }) => {
      if (data.data?.chatStream) {
        const assistantMessage: Message = {
          id: data.data.chatStream.id,
          content: data.data.chatStream.response,
          role: "assistant",
          timestamp: new Date(data.data.chatStream.timestamp),
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
      }
    },
  });

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      role: "user",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      await sendMessage({
        variables: {
          message: content.trim(),
          sessionId,
        },
      });
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "응답 생성 중 오류가 발생했음.",
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  return {
    messages,
    isLoading,
    sendMessage: handleSendMessage,
  };
}