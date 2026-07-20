import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { NAV_ITEMS } from "./nav-config";
import { useRoles, useAuth } from "@/hooks/use-auth";
import { Activity } from "lucide-react";

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const { isAdmin } = useRoles(user?.id);

  const sections = ["Trading", "Analytics", "Configuration", "System"] as const;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <Activity className="h-4 w-4" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold">P4 Bot</p>
            <p className="truncate text-xs text-muted-foreground">Trading Console</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section) => {
          const items = NAV_ITEMS.filter(
            (i) => i.section === section && (!i.adminOnly || isAdmin),
          );
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={section}>
              <SidebarGroupLabel>{section}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const active = pathname === item.to || pathname.startsWith(item.to + "/");
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                          <Link to={item.to}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-1 text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
          v0.2 · Milestone 2
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
