import React from 'react';
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import App from './App';

export const AppRouter = () => {
    const { session, loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '20px',
                fontFamily: "'Inter', sans-serif",
            }}>
                <div style={{
                    width: '64px', height: '64px', borderRadius: '18px',
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '28px', boxShadow: '0 8px 20px rgba(59,130,246,0.4)',
                    animation: 'pulse 1.5s infinite',
                }}>
                    🏗️
                </div>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontWeight: '600', letterSpacing: '1px' }}>
                    CARREGANDO...
                </p>
                <style>{`@keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.7; transform:scale(0.95); } }`}</style>
            </div>
        );
    }

    // Se não há sessão ativa, mostra o Login
    if (!session) {
        return <LoginPage />;
    }

    // Se estiver logado, mostra o quadro
    return <App />;
};
