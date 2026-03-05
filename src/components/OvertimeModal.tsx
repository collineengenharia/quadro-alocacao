import React, { useState } from 'react';
import { X, Zap, Clock, Save, Trash2 } from 'lucide-react';
import type { Resource, OvertimeEntry } from '../types';

interface OvertimeModalProps {
    resource: Resource;
    currentOvertime?: OvertimeEntry;
    onSave: (entry: OvertimeEntry) => void;
    onDelete: () => void;
    onClose: () => void;
}

export const OvertimeModal: React.FC<OvertimeModalProps> = ({
    resource,
    currentOvertime,
    onSave,
    onDelete,
    onClose
}) => {
    const [hours, setHours] = useState(currentOvertime?.hours.toString() || '');
    const [multiplier, setMultiplier] = useState<1.5 | 2.0>(currentOvertime?.multiplier || 1.5);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const h = parseFloat(hours);
        if (isNaN(h) || h <= 0) {
            alert("Por favor, insira uma quantidade de horas válida.");
            return;
        }
        onSave({
            hours: h,
            multiplier: multiplier
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
            <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div className="modal-header">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>
                        <Zap size={22} color="#8b5cf6" fill="#8b5cf6" /> Registro de Hora Extra
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <X size={24} />
                    </button>
                </div>

                <div className="modal-body" style={{ padding: '24px' }}>
                    <div style={{ background: '#f5f3ff', padding: '16px', borderRadius: '16px', marginBottom: '24px', border: '1px solid #ddd6fe' }}>
                        <div style={{ fontSize: '12px', color: '#7c3aed', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Colaborador</div>
                        <div style={{ fontSize: '16px', fontWeight: '900', color: '#1e293b' }}>{resource.name}</div>
                        <div style={{ fontSize: '12px', color: '#6d28d9', marginTop: '2px' }}>{resource.role}</div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', color: '#1e293b', marginBottom: '10px' }}>
                                Quantidade de Horas
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Clock size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    type="number"
                                    step="0.5"
                                    min="0.5"
                                    value={hours}
                                    onChange={(e) => setHours(e.target.value)}
                                    placeholder="Ex: 2 ou 2.5"
                                    autoFocus
                                    style={{
                                        width: '100%',
                                        padding: '16px 16px 16px 48px',
                                        borderRadius: '16px',
                                        border: '2px solid #e2e8f0',
                                        fontSize: '18px',
                                        fontWeight: '900',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                        background: '#f8fafc'
                                    }}
                                    required
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '32px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', color: '#1e293b', marginBottom: '10px' }}>
                                Tipo de Adicional
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setMultiplier(1.5)}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '12px',
                                        border: '2px solid',
                                        borderColor: multiplier === 1.5 ? '#8b5cf6' : '#e2e8f0',
                                        background: multiplier === 1.5 ? '#f5f3ff' : 'white',
                                        color: multiplier === 1.5 ? '#8b5cf6' : '#64748b',
                                        fontWeight: '800',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    50% (SÁB/DIUR)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMultiplier(2.0)}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '12px',
                                        border: '2px solid',
                                        borderColor: multiplier === 2.0 ? '#8b5cf6' : '#e2e8f0',
                                        background: multiplier === 2.0 ? '#f5f3ff' : 'white',
                                        color: multiplier === 2.0 ? '#8b5cf6' : '#64748b',
                                        fontWeight: '800',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    100% (DOM/FER)
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                type="submit"
                                style={{
                                    flex: 2,
                                    background: '#8b5cf6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '16px',
                                    padding: '18px',
                                    fontWeight: '900',
                                    fontSize: '16px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    boxShadow: '0 8px 20px rgba(139, 92, 246, 0.3)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Save size={20} /> Salvar Extra
                            </button>
                            {currentOvertime && (
                                <button
                                    type="button"
                                    onClick={onDelete}
                                    style={{
                                        flex: 1,
                                        background: '#fee2e2',
                                        color: '#ef4444',
                                        border: 'none',
                                        borderRadius: '16px',
                                        padding: '18px',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    title="Remover"
                                >
                                    <Trash2 size={24} />
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
