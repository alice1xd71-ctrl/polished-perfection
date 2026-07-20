import { Outlet } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "./theme-toggle";
import { GlobalSearch } from "./global-search";
import { NotificationCenter } from "./notification-center";
import { SettingsDrawer } from "./settings-drawer";
import { Breadcrumbs } from "./breadcrumbs";
import { AppFooter } from "./footer";
import { Separator } from "@/components/ui/separator";

export function AppShell() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <div className="hidden min-w-0 flex-1 md:block">
            <Breadcrumbs />
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <GlobalSearch />
            <NotificationCenter />
            <SettingsDrawer />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
        <AppFooter />
      </SidebarInset>
    </SidebarProvider>
  );
}
