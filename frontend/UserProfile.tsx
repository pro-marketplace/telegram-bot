/**
 * Telegram Auth Extension - User Profile
 *
 * Component to display user data after Telegram login.
 */
import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// =============================================================================
// TYPES
// =============================================================================

interface User {
  id: number;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  telegram_id: string;
}

interface UserProfileProps {
  /** User data from useTelegramAuth */
  user: User;
  /** Logout function from useTelegramAuth */
  onLogout: () => Promise<void>;
  /** Loading state */
  isLoading?: boolean;
  /** CSS class for Card */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function UserProfile({
  user,
  onLogout,
  isLoading = false,
  className = "",
}: UserProfileProps): React.ReactElement {
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "TG";

  const handleLogout = async () => {
    await onLogout();
  };

  return (
    <Card className={className}>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <Avatar className="h-20 w-20">
            {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name || "User"} />}
            <AvatarFallback className="text-2xl bg-[#0088cc] text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
        <CardTitle className="text-xl">
          {user.name || "Пользователь Telegram"}
        </CardTitle>
        {user.email && <CardDescription>{user.email}</CardDescription>}
      </CardHeader>

      <CardContent className="space-y-3">
        {user.email && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Email</span>
            <span>{user.email}</span>
          </div>
        )}

        {user.name && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Имя</span>
            <span>{user.name}</span>
          </div>
        )}

        {user.telegram_id && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Telegram ID</span>
            <span>{user.telegram_id}</span>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button
          variant="outline"
          className="w-full"
          onClick={handleLogout}
          disabled={isLoading}
        >
          {isLoading ? "Выход..." : "Выйти"}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default UserProfile;
