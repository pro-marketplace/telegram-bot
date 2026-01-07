/**
 * Telegram Bot Extension - Notifications Hook
 *
 * Hook for sending notifications via Telegram Bot.
 */

import { useState, useCallback } from "react";

// =============================================================================
// TYPES
// =============================================================================

interface UseTelegramBotConfig {
  apiUrl: string;
}

interface SendMessageParams {
  text: string;
  chat_id?: string;
  parse_mode?: "HTML" | "Markdown";
  silent?: boolean;
}

interface SendPhotoParams {
  photo_url: string;
  caption?: string;
  chat_id?: string;
}

interface SendTestParams {
  chat_id?: string;
}

interface SendResult {
  success: boolean;
  message_id?: number;
  error?: string;
}

interface UseTelegramBotReturn {
  /** Send text message */
  sendMessage: (params: SendMessageParams) => Promise<SendResult>;
  /** Send photo with caption */
  sendPhoto: (params: SendPhotoParams) => Promise<SendResult>;
  /** Send test message to verify configuration */
  sendTest: (params?: SendTestParams) => Promise<SendResult>;
  /** Loading state */
  isLoading: boolean;
  /** Last error message */
  error: string | null;
}

// =============================================================================
// HOOK
// =============================================================================

export function useTelegramBot({ apiUrl }: UseTelegramBotConfig): UseTelegramBotReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (params: SendMessageParams): Promise<SendResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiUrl}?action=send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Send failed");
          return { success: false, error: data.error };
        }

        return { success: true, message_id: data.message_id };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [apiUrl]
  );

  const sendPhoto = useCallback(
    async (params: SendPhotoParams): Promise<SendResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiUrl}?action=send-photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Send failed");
          return { success: false, error: data.error };
        }

        return { success: true, message_id: data.message_id };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [apiUrl]
  );

  const sendTest = useCallback(
    async (params?: SendTestParams): Promise<SendResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiUrl}?action=test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params || {}),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Test failed");
          return { success: false, error: data.error };
        }

        return { success: true, message_id: data.message_id };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [apiUrl]
  );

  return { sendMessage, sendPhoto, sendTest, isLoading, error };
}

export default useTelegramBot;
