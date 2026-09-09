import { useApp } from "./store";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { EditorArea } from "./components/EditorArea";
import { DirBanner } from "./components/DirBanner";
import { Toasts } from "./components/Toasts";
import { ConflictModal } from "./components/ConflictModal";
import { HistoryModal } from "./components/HistoryModal";
import { SetupWizard } from "./screens/SetupWizard";
import { WorkspaceTools } from "./components/WorkspaceTools";

export function App() {
  const { loading, configured, showSetup, historyOpen } = useApp();

  if (loading) {
    return (
      <div className="splash">
        <span className="splash__logo">
          <svg width="42" height="42" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="url(#gs)" />
            <path d="M9 11l7 10 7-10h-4l-3 4.5L13 11z" fill="#fff" />
            <defs>
              <linearGradient id="gs" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#8b7bff" />
                <stop offset="1" stopColor="#5ad0ff" />
              </linearGradient>
            </defs>
          </svg>
        </span>
        <span className="spinner spinner--lg" />
        <p>Starting Homepage Manager…</p>
      </div>
    );
  }

  // First-run / setup state (no config yet) → dedicated setup screen.
  if (!configured && showSetup) {
    return (
      <div className="shell shell--setup">
        <SetupWizard />
        <Toasts />
      </div>
    );
  }

  return (
    <div className="shell">
      <TopBar />
      <div className="workbench">
        <Sidebar />
        <main className="content">
          <DirBanner />
          <WorkspaceTools><EditorArea /></WorkspaceTools>
        </main>
      </div>
      {showSetup && configured && (
        <div className="overlay">
          <SetupWizard />
        </div>
      )}
      {historyOpen && configured && <HistoryModal />}
      <ConflictModal />
      <Toasts />
    </div>
  );
}
