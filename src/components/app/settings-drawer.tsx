import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/lib/theme";
import { Button as UIButton } from "@/components/ui/button";

export function SettingsDrawer() {
  const { theme, setTheme } = useTheme();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Quick settings">
          <Settings2 className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Quick settings</SheetTitle>
          <SheetDescription>
            Runtime preferences for this device. Account settings live under Settings.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label>Appearance</Label>
            <div className="flex gap-2">
              {(["light", "dark", "system"] as const).map((t) => (
                <UIButton
                  key={t}
                  variant={theme === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </UIButton>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Density</Label>
            <p className="text-xs text-muted-foreground">Compact layout coming soon.</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
