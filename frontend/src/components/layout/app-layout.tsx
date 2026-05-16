import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { CreateCollectionDialog } from "@/components/collections/create-collection-dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          "hidden w-64 shrink-0 border-r lg:block",
          !sidebarOpen && "lg:hidden",
        )}
      >
        <Sidebar onCreateCollection={() => setCreateDialogOpen(true)} />
      </aside>

      <Sheet
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
      >
        <SheetContent side="left" className="w-64 p-0 lg:hidden">
          <Sidebar onCreateCollection={() => setCreateDialogOpen(true)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <CreateCollectionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
