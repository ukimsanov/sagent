"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Settings,
} from "lucide-react";
import type { AuthUser } from "@/types/auth";

interface AppSidebarProps {
  user: AuthUser | null;
}

const navItems = [
  {
    title: "Overview",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Conversations",
    href: "/conversations",
    icon: MessageSquare,
  },
  {
    title: "Leads",
    href: "/leads",
    icon: Users,
  },
];

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  // user prop is available for future use (e.g., displaying user info in sidebar)

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <Link href="/" className="flex items-center gap-2 group">
          <motion.div
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 ring-1 ring-emerald-100 shadow-sm dark:bg-emerald-900/30 dark:ring-emerald-800/60"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Image
              src="/WhatsApp-Brand-Resource-Center/01_Glyph/01_Digital/02_SVG/Green/Digital_Glyph_Green.svg"
              alt="WhatsApp logo"
              width={18}
              height={18}
              className="block dark:hidden"
              priority
            />
            <Image
              src="/WhatsApp-Brand-Resource-Center/01_Glyph/01_Digital/02_SVG/White/Digital_Glyph_White.svg"
              alt="WhatsApp logo"
              width={18}
              height={18}
              className="hidden dark:block"
              priority
            />
          </motion.div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold group-hover:text-primary transition-colors">
              WhatsApp Agent
            </span>
            <span className="text-xs text-muted-foreground">Dashboard</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item, index) => {
                const isActive = pathname === item.href;
                return (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: index * 0.05,
                      duration: 0.3,
                      ease: [0.4, 0, 0.2, 1],
                    }}
                  >
                    <SidebarMenuItem className="relative">
                      {isActive && (
                        <motion.div
                          layoutId="activeIndicator"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full"
                          initial={false}
                          transition={{
                            type: "spring",
                            stiffness: 350,
                            damping: 30,
                          }}
                        />
                      )}
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="transition-all duration-200"
                      >
                        <Link href={item.href} className="relative">
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                          >
                            <item.icon className="h-4 w-4" />
                          </motion.div>
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </motion.div>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <SidebarMenu>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <SidebarMenuItem className="relative">
              {pathname === "/settings" && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 350,
                    damping: 30,
                  }}
                />
              )}
              <SidebarMenuButton
                asChild
                isActive={pathname === "/settings"}
                className="transition-all duration-200"
              >
                <Link href="/settings">
                  <motion.div
                    whileHover={{ rotate: 90 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <Settings className="h-4 w-4" />
                  </motion.div>
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </motion.div>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
