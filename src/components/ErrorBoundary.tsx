import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in ErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Soft reset by trying to render children again or reloading page
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center p-8 my-6 border border-red-500/20 bg-red-950/10 rounded-xl text-center backdrop-blur-md shadow-lg shadow-red-950/5">
          <div className="p-3 bg-red-500/10 rounded-full mb-4 border border-red-500/20">
            <AlertTriangle className="h-8 w-8 text-red-500 animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-red-400 mb-2">Painel de Interface Suspenso</h3>
          <p className="text-sm text-neutral-400 max-w-sm mb-6 leading-relaxed">
            Ocorreu uma falha ao renderizar este componente. Os dados subjacentes continuam seguros.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleReset}
            className="flex items-center gap-2 border-red-500/30 hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-all duration-300"
          >
            <RefreshCw className="h-4 w-4" />
            Recarregar Painel
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
