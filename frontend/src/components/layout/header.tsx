import { useLocation, Link } from "react-router-dom";
import { Menu, Moon, Sun, Monitor, ChevronRight, FileText, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUIStore } from "@/stores/ui-store";
import { useCollection } from "@/hooks/use-collections";

function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  const collectionId =
    segments[0] === "collections" && segments[1] ? segments[1] : undefined;

  const { data: collection } = useCollection(collectionId ?? "");

  const crumbs: { label: string; to: string }[] = [];

  if (collectionId && collection) {
    crumbs.push({
      label: collection.name,
      to: `/collections/${collectionId}`,
    });
  }

  if (segments.includes("chat")) {
    crumbs.push({
      label: "Chat",
      to: location.pathname,
    });
  }

  if (segments.includes("evaluation")) {
    crumbs.push({
      label: "Evaluation",
      to: location.pathname,
    });
  }

  if (crumbs.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      {crumbs.map((crumb, i) => (
        <span key={crumb.to} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="mx-0.5 h-3.5 w-3.5" />}
          {i === crumbs.length - 1 ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link
              to={crumb.to}
              className="transition-colors hover:text-foreground"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export function Header() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background/80 backdrop-blur-sm px-4">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 lg:hidden"
        onClick={toggleSidebar}
      >
        <Menu className="h-4 w-4" />
      </Button>

      <Link to="/" className="flex items-center gap-2 mr-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
          <FileText className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="text-base font-semibold tracking-tight">DocuMind</span>
      </Link>

      <div className="h-5 w-px bg-border" />

      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              {theme === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : theme === "light" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Monitor className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 h-4 w-4" />
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
