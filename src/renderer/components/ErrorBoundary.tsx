import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, FolderOpen, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    if (window.electronAPI && (window.electronAPI as any).logError) {
      (window.electronAPI as any).logError('React ErrorBoundary caught error', error.stack || error.message);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleOpenLogs = () => {
    if (window.electronAPI && window.electronAPI.openLogsFolder) {
      window.electronAPI.openLogsFolder();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-slate-950 text-slate-100 p-6 select-none">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto text-rose-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h1 className="text-xl font-bold text-slate-100">Vanya Downloader</h1>
              <p className="text-sm text-slate-400">Vanya Downloader could not load the interface.</p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-left overflow-auto max-h-32 text-xs font-mono text-rose-300/90 break-words">
                {this.state.error.message || 'An unexpected rendering error occurred.'}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-xl shadow-md transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
              <button
                onClick={this.handleOpenLogs}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Open Logs
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
