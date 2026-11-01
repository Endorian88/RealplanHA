import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      errorMsg: error?.message || 'Unbekannter Laufzeitfehler',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-rose-500/40 p-5 space-y-3 shadow-2xl">
            <div className="text-sm font-bold text-rose-300">
              RealPlan 3D · Wiederherstellung
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Beim Laden des gespeicherten Projekts ist ein Fehler aufgetreten (
              <span className="font-mono text-amber-300">{this.state.errorMsg}</span>).
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, errorMsg: '' });
                }}
                className="px-3 py-1.5 rounded-lg bg-sky-500 text-slate-950 text-xs font-bold"
              >
                Erneut versuchen
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem('realplan3d_estate_project_v7_empty');
                  } catch {
                    // ignore
                  }
                  window.location.reload();
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10"
              >
                Lokalen Cache zurücksetzen & neu starten
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);

