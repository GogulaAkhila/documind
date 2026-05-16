import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

interface UIState {
  sidebarOpen: boolean;
  theme: Theme;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: Theme) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: "system",

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setTheme: (theme) => {
        const root = document.documentElement;
        root.classList.remove("light", "dark");

        if (theme === "system") {
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          root.classList.add(prefersDark ? "dark" : "light");
        } else {
          root.classList.add(theme);
        }

        set({ theme });
      },
    }),
    {
      name: "documind-ui",
      partialize: (state) => ({ theme: state.theme, sidebarOpen: state.sidebarOpen }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setTheme(state.theme);
        }
      },
    },
  ),
);
