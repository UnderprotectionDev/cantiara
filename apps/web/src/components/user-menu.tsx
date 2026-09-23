import { Button } from "@cantiara/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@cantiara/ui/components/dropdown-menu";
import { Skeleton } from "@cantiara/ui/components/skeleton";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const signOut = useCallback(() => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigate({
            to: "/",
          });
        },
      },
    });
  }, [navigate]);

  if (isPending) {
    return <Skeleton className="h-9 w-9 rounded-full sm:w-24" />;
  }

  if (!session) {
    return (
      <Link to="/login">
        <Button variant="outline">Continue with GitHub</Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={session.user.name}
        render={<Button className="rounded-full px-3" variant="outline" />}
      >
        <span className="hidden sm:inline">{session.user.name}</span>
        <span className="sm:hidden">
          {session.user.name.slice(0, 1).toUpperCase()}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>{session.user.email}</DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/account" />}>
            Sessions
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/account/preferences" />}>
            Preferences
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/account/completion-effects" />}>
            Completion effects
          </DropdownMenuItem>
          <DropdownMenuItem onClick={signOut} variant="destructive">
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
