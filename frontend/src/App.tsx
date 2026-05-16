import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { AppLayout } from "@/components/layout/app-layout";
import { Home } from "@/pages/home";
import { CollectionDetail } from "@/pages/collection-detail";
import { ChatPage } from "@/pages/chat-page";
import { EvaluationPage } from "@/pages/evaluation-page";

export default function App() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <TooltipProvider delay={300}>
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/collections/:id" element={<CollectionDetail />} />
                <Route
                  path="/collections/:id/chat/:sessionId"
                  element={<ChatPage />}
                />
                <Route
                  path="/collections/:id/evaluation"
                  element={<EvaluationPage />}
                />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster richColors position="bottom-right" />
        </TooltipProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
