import { useRouterState, Link } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { NAV_ITEMS } from "./nav-config";

export function Breadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const segments = pathname.split("/").filter(Boolean);
  const items = segments.map((seg, i) => {
    const to = "/" + segments.slice(0, i + 1).join("/");
    const nav = NAV_ITEMS.find((n) => n.to === to);
    return { to, label: nav?.title ?? seg.replace(/-/g, " ") };
  });
  if (items.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((it, i) => (
          <BreadcrumbItem key={it.to}>
            {i === items.length - 1 ? (
              <BreadcrumbPage className="capitalize">{it.label}</BreadcrumbPage>
            ) : (
              <>
                <BreadcrumbLink asChild>
                  <Link to={it.to} className="capitalize">{it.label}</Link>
                </BreadcrumbLink>
                <BreadcrumbSeparator />
              </>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
