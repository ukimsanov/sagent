"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface AnimatedSectionProps {
  title: string;
  children: React.ReactNode;
  delay?: number;
  href?: string;
  linkText?: string;
}

export function AnimatedSection({
  title,
  children,
  delay = 0,
  href,
  linkText = "View all",
}: AnimatedSectionProps) {
  return (
    <BlurFade delay={delay}>
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {href && (
            <Link
              href={href}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1 transition-colors"
            >
              {linkText}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </BlurFade>
  );
}
