import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        } catch (err: any) {
            const msg = err?.message || 'Erro desconhecido';
            if (msg.includes('Invalid login credentials')) {
                setError('E-mail ou senha incorretos.');
            } else {
                setError(msg);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            fontFamily: "'Inter', sans-serif",
        }}>
            {/* Decorative background circles */}
            <div style={{
                position: 'fixed', top: '-100px', right: '-100px',
                width: '400px', height: '400px', borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.08)', pointerEvents: 'none'
            }} />
            <div style={{
                position: 'fixed', bottom: '-150px', left: '-100px',
                width: '500px', height: '500px', borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.05)', pointerEvents: 'none'
            }} />

            <div style={{
                width: '100%', maxWidth: '420px',
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '24px',
                padding: '40px',
                boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
                position: 'relative',
                zIndex: 1,
            }}>
                {/* Logo / Header */}
                <div style={{ textAlign: 'center', marginBottom: '36px' }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '18px',
                        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px', fontSize: '28px',
                        boxShadow: '0 8px 20px rgba(59,130,246,0.4)',
                    }}>
                        🏗️
                    </div>
                    <h1 style={{
                        fontSize: '22px', fontWeight: '900', color: 'white',
                        letterSpacing: '-0.5px', marginBottom: '4px',
                    }}>
                        COLLINE ENGENHARIA
                    </h1>
                    <p style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px' }}>
                        Quadro de Alocação Digital
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                            E-mail
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            required
                            autoFocus
                            style={{
                                width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px',
                                color: 'white', fontSize: '15px', outline: 'none',
                                transition: 'border-color 0.2s',
                                fontFamily: 'inherit',
                            }}
                            onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                            onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                            Senha
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                            style={{
                                width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px',
                                color: 'white', fontSize: '15px', outline: 'none',
                                transition: 'border-color 0.2s',
                                fontFamily: 'inherit',
                            }}
                            onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                            onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
                        />
                    </div>

                    {error && (
                        <div style={{
                            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '10px', padding: '12px', marginBottom: '16px',
                            color: '#fca5a5', fontSize: '13px', fontWeight: '500',
                        }}>
                            ⚠️ {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{
                            width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
                            background: isLoading ? 'rgba(59,130,246,0.5)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                            color: 'white', fontWeight: '800', fontSize: '15px', cursor: isLoading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: isLoading ? 'none' : '0 8px 20px rgba(59,130,246,0.35)',
                            fontFamily: 'inherit',
                        }}>
                        {isLoading ? '⏳ Aguarde...' : '🔑 Entrar no Sistema'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>
                    Acesso restrito · Colline Engenharia · <b>V2.1</b>
                </p>
            </div>
        </div>
    );
};
