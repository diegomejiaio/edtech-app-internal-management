import type { UserResponse } from "@/types";

/**
 * Get initials from a user for avatar display
 */
export function getMemberInitials(user: UserResponse): string {
  if (user.name) {
    return user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return user.email.slice(0, 2).toUpperCase();
}

/**
 * Get display name for a user (name or email username)
 */
export function getMemberDisplayName(user: UserResponse): string {
  return user.name || user.email.split("@")[0];
}
