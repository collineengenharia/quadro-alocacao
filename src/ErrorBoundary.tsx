import React, { Component, type ReactNode } from "react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: any) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
                    <h1 style={{ color: '#ef4444' }}>⚠️ Algo deu errado no aplicativo</h1>
                    <p style={{ color: '#64748b', marginBottom: '20px' }}>Ocorreu um erro inesperado que impediu o carregamento da tela.</p>
                    <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'inline-block', textAlign: 'left', maxWidth: '800px' }}>
                        <p style={{ fontWeight: 'bold', margin: '0 0 10px 0' }}>Erro técnico:</p>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#dc2626', fontSize: '13px' }}>
                            {this.state.error?.toString()}
                            {"\n\nStack Trace:\n"}
                            {this.state.error?.stack}
                        </pre>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                            Tentar Novamente (F5)
                        </button>
                        <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={{ padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '10px' }}>
                            Limpar Dados Salvos (Cuidado!)
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
