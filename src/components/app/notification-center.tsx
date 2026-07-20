import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmptyState } from "./empty-state";

export function NotificationCenter() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b p-3">
          <p className="text-sm font-medium">Notifications</p>
          <p className="text-xs text-muted-foreground">Alerts from the trading engine</p>
        </div>
        <div className="p-6">
          <EmptyState
            title="You're all caught up"
            description="Engine alerts and system notices will appear here."
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
