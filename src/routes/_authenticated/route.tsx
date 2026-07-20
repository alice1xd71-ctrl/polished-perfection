import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Auth gate for the whole /_authenticated/* subtree.
// ssr: false because Supabase persists the session in localStorage and the
// server can't read it. Gating server-side would loop on hard-refresh and
// flash the auth page for signed-in users.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
