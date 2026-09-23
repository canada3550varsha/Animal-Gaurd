import { useNavigate } from "react-router-dom";

// Consistent sub-page chrome for focused flows (farm detail, register farm,
// symptom/voice reporting, architecture). Keeps one white header + centered
// content column so those screens match the dashboard shell without a sidebar.
export default function Page({ title, sub, back = -1, onBack, maxW = "max-w-7xl", children }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-white border-b border-gray-200/70 sticky top-0 z-30">
        <div className={`mx-auto ${maxW} px-4 lg:px-6 h-14 flex items-center gap-3`}>
          <button
            onClick={() => (onBack ? onBack() : navigate(back))}
            className="btn-ghost p-2 -ml-2 text-lg leading-none"
            title="Back"
            aria-label="Back"
          >
            ←
          </button>
          <h1 className="font-bold text-ink text-base truncate">{title}</h1>
          {sub && <span className="hidden sm:inline text-xs text-gray-400 truncate">{sub}</span>}
        </div>
      </header>
      <main className={`mx-auto ${maxW} px-4 lg:px-6 py-5 lg:py-6`}>{children}</main>
    </div>
  );
}