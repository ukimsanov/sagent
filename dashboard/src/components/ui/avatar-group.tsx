"use client";

import * as React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface AvatarGroupItem {
  src?: string;
  fallback: string;
  alt?: string;
}

interface AvatarGroupProps {
  avatars: AvatarGroupItem[];
  max?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "size-6 text-xs",
  md: "size-8 text-sm",
  lg: "size-10 text-base",
};

const overlapClasses = {
  sm: "-space-x-2",
  md: "-space-x-2.5",
  lg: "-space-x-3",
};

export function AvatarGroup({
  avatars,
  max = 4,
  size = "md",
  className,
}: AvatarGroupProps) {
  const displayAvatars = avatars.slice(0, max);
  const remainingCount = avatars.length - max;

  return (
    <div
      className={cn(
        "flex items-center",
        overlapClasses[size],
        "hover:[&>*]:translate-x-0.5 hover:[&>*:first-child]:translate-x-0",
        className
      )}
    >
      {displayAvatars.map((avatar, index) => (
        <Avatar
          key={index}
          className={cn(
            sizeClasses[size],
            "ring-2 ring-background transition-transform duration-200 hover:z-10 hover:scale-110"
          )}
          style={{ zIndex: displayAvatars.length - index }}
        >
          {avatar.src && (
            <AvatarImage src={avatar.src} alt={avatar.alt || avatar.fallback} />
          )}
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {avatar.fallback}
          </AvatarFallback>
        </Avatar>
      ))}
      {remainingCount > 0 && (
        <Avatar
          className={cn(
            sizeClasses[size],
            "ring-2 ring-background bg-muted"
          )}
          style={{ zIndex: 0 }}
        >
          <AvatarFallback className="bg-muted text-muted-foreground font-medium">
            +{remainingCount}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
