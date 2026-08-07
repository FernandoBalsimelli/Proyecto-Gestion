import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[App crash]', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 max-w-lg w-full text-center space-y-4">
          <div className="w-14 h-14 bg-rose-500/20 rounded-2xl flex items-center justify-center mx-auto text-3xl">
            ⚠️
          </div>
          <h1 className="text-xl font-bold text-white">Ocurrió un error inesperado</h1>
          <p className="text-slate-400 text-sm">
            Intenta recargar la página. Si el problema continúa, avísale al administrador.
          </p>

          <pre className="bg-slate-950 text-rose-300 text-[11px] p-3 rounded-xl text-left overflow-auto max-h-40 font-mono">
            {String(this.state.error?.message || this.state.error)}
          </pre>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl">
              Recargar
            </button>
            <button
              onClick={() => { localStorage.clear(); window.location.href = '/'; }}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-xl">
              Reiniciar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }
}