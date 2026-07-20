import {
  LayoutDashboard,
  LineChart,
  ListOrdered,
  Wallet,
  History,
  BookOpen,
  Settings2,
  Layers,
  BarChart3,
  Rewind,
  HeartPulse,
  Bell,
  Settings,
  ShieldCheck,
  Activity,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  to: string;
  icon: LucideIcon;
  section: "Trading" | "Analytics" | "Configuration" | "System";
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard, section: "Trading" },
  { title: "Standing Limit Order", to: "/standing-orders", icon: Settings2, section: "Trading" },
  { title: "Markets", to: "/markets", icon: LineChart, section: "Trading" },
  { title: "Orders", to: "/orders", icon: ListOrdered, section: "Trading" },
  { title: "Positions", to: "/positions", icon: Wallet, section: "Trading" },
  { title: "Trades", to: "/trades", icon: History, section: "Trading" },
  { title: "Ledger", to: "/ledger", icon: BookOpen, section: "Analytics" },
  { title: "Analytics", to: "/analytics", icon: BarChart3, section: "Analytics" },
  { title: "Replay", to: "/replay", icon: Rewind, section: "Analytics" },
  { title: "Strategy Profiles", to: "/strategy-profiles", icon: Layers, section: "Configuration" },
  { title: "Health Monitor", to: "/health", icon: HeartPulse, section: "System" },
  { title: "Operations", to: "/operations", icon: Activity, section: "System" },
  { title: "Notifications", to: "/notifications", icon: Bell, section: "System" },
  { title: "Settings", to: "/settings", icon: Settings, section: "System" },
  { title: "Administration", to: "/admin", icon: ShieldCheck, section: "System", adminOnly: true },
];
