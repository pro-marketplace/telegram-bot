/**
 * Telegram Auth Extension - useTelegramAuth Hook
 *
 * React hook for Telegram bot authentication.
 * Uses polling to check auth status after redirect to bot.
 */
import { useState, useCallback, useEffect, useRef } from "react";

// =============================================================================
// TYPES
// =============================================================================

const REFRESH_TOKEN_KEY = "telegram_auth_refresh_token";

export interface User {
  id: number;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  telegram_id: string;
}

interface AuthApiUrls {
  authUrl: string;
  checkAuth: string;
  refresh: string;
  logout: string;
}

interface UseTelegramAuthOptions {
  apiUrls: AuthApiUrls;
  onAuthChange?: (user: User | null) => void;
  autoRefresh?: boolean;
  refreshBeforeExpiry?: number;
  /** Polling interval in ms while waiting for bot auth (default: 2000) */
  pollingInterval?: number;
  /** Max polling time in ms (default: 600000 = 10 min) */
  pollingTimeout?: number;
}

interface UseTelegramAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isWaitingForBot: boolean;
  error: string | null;
  accessToken: string | null;
  login: () => Promise<void>;
  cancelLogin: () => void;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  getAuthHeader: () => { Authorization: string } | {};
}

// =============================================================================
// LOCAL STORAGE
// =============================================================================

function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setStoredRefreshToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

function clearStoredRefreshToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// =============================================================================
// HOOK
// =============================================================================

export function useTelegramAuth(options: UseTelegramAuthOptions): UseTelegramAuthReturn {
  const {
    apiUrls,
    onAuthChange,
    autoRefresh = true,
    refreshBeforeExpiry = 60,
    pollingInterval = 2000,
    pollingTimeout = 600000,
  } = options;

  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWaitingForBot, setIsWaitingForBot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingStartRef = useRef<number>(0);
  const currentTokenRef = useRef<string | null>(null);

  const clearAuth = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
    }
    setAccessToken(null);
    setUser(null);
    setIsWaitingForBot(false);
    clearStoredRefreshToken();
    currentTokenRef.current = null;
  }, []);

  const scheduleRefresh = useCallback(
    (expiresInSeconds: number, refreshFn: () => Promise<boolean>) => {
      if (!autoRefresh) return;

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      const refreshIn = Math.max((expiresInSeconds - refreshBeforeExpiry) * 1000, 1000);

      refreshTimerRef.current = setTimeout(async () => {
        const success = await refreshFn();
        if (!success) {
          clearAuth();
        }
      }, refreshIn);
    },
    [autoRefresh, refreshBeforeExpiry, clearAuth]
  );

  const refreshTokenFn = useCallback(async (): Promise<boolean> => {
    const storedRefreshToken = getStoredRefreshToken();
    if (!storedRefreshToken) {
      return false;
    }

    try {
      const response = await fetch(apiUrls.refresh, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: storedRefreshToken }),
      });

      if (!response.ok) {
        clearAuth();
        return false;
      }

      const data = await response.json();
      setAccessToken(data.access_token);
      setUser(data.user);
      scheduleRefresh(data.expires_in, refreshTokenFn);
      return true;
    } catch {
      clearAuth();
      return false;
    }
  }, [apiUrls.refresh, clearAuth, scheduleRefresh]);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const hasToken = !!getStoredRefreshToken();
      if (hasToken) {
        await refreshTokenFn();
      }
      setIsLoading(false);
    };

    restoreSession();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
      }
    };
  }, [refreshTokenFn]);

  // Notify on auth change
  useEffect(() => {
    onAuthChange?.(user);
  }, [user, onAuthChange]);

  /**
   * Poll for auth status
   */
  const pollAuthStatus = useCallback(async (token: string): Promise<void> => {
    // Check timeout
    if (Date.now() - pollingStartRef.current > pollingTimeout) {
      setError("Authentication timeout. Please try again.");
      setIsWaitingForBot(false);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${apiUrls.checkAuth}&token=${token}`);
      const data = await response.json();

      if (data.status === "pending") {
        // Still waiting for bot - continue polling
        pollingTimerRef.current = setTimeout(() => {
          pollAuthStatus(token);
        }, pollingInterval);
        return;
      }

      if (data.status === "authenticated") {
        // Success!
        setAccessToken(data.access_token);
        setUser(data.user);
        setStoredRefreshToken(data.refresh_token);
        scheduleRefresh(data.expires_in, refreshTokenFn);
        setIsWaitingForBot(false);
        setIsLoading(false);
        return;
      }

      if (data.status === "expired" || data.status === "used") {
        setError("Token expired. Please try again.");
        setIsWaitingForBot(false);
        setIsLoading(false);
        return;
      }

      // Unknown status
      setError(data.error || "Authentication failed");
      setIsWaitingForBot(false);
      setIsLoading(false);
    } catch (err) {
      // Network error - retry
      pollingTimerRef.current = setTimeout(() => {
        pollAuthStatus(token);
      }, pollingInterval);
    }
  }, [apiUrls.checkAuth, pollingInterval, pollingTimeout, scheduleRefresh, refreshTokenFn]);

  /**
   * Start Telegram login flow
   */
  const login = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(apiUrls.authUrl, {
        method: "GET",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to get auth URL");
        setIsLoading(false);
        return;
      }

      // Store token for polling
      currentTokenRef.current = data.token;
      pollingStartRef.current = Date.now();
      setIsWaitingForBot(true);

      // Open Telegram bot in new tab
      window.open(data.bot_url, "_blank");

      // Start polling for auth status
      pollAuthStatus(data.token);
    } catch (err) {
      setError("Network error");
      setIsLoading(false);
    }
  }, [apiUrls.authUrl, pollAuthStatus]);

  /**
   * Cancel login process
   */
  const cancelLogin = useCallback(() => {
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
    }
    setIsWaitingForBot(false);
    setIsLoading(false);
    setError(null);
    currentTokenRef.current = null;
  }, []);

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    const storedRefreshToken = getStoredRefreshToken();

    try {
      await fetch(apiUrls.logout, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: storedRefreshToken || "" }),
      });
    } catch {
      // Ignore errors
    }

    clearAuth();
  }, [apiUrls.logout, clearAuth]);

  /**
   * Get Authorization header for API requests
   */
  const getAuthHeader = useCallback(() => {
    if (!accessToken) return {};
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  return {
    user,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    isWaitingForBot,
    error,
    accessToken,
    login,
    cancelLogin,
    logout,
    refreshToken: refreshTokenFn,
    getAuthHeader,
  };
}

export default useTelegramAuth;
