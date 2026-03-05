import React, { useState } from 'react';
import { X, Clock } from 'lucide-react';
import type { Resource } from '../types';

interface HourSplitModalProps {
    resource: Resource;
    currentDate: Date;
    currentHours?: number;
    onSave: (hours: number, options: { earlyDismissal?: boolean, maintenanceAfter?: boolean }) => void;
    onDelete: () => void;
    onClose: () => void;
}

const getMaxHoursForDate = (date: Date): number => {
    const dayOfWeek = date.getDay(); // 0 = Domingo, 5 = Sexta
    if (dayOfWeek === 0 || dayOfWeek === 6) return 0; // Fim de semana
    return dayOfWeek === 5 ? 8 : 9; // Sexta = 8h, Seg-Qui = 9h
};

export const HourSplitModal: React.FC<HourSplitModalProps> = ({
    resource,
    currentDate,
    currentHours,
    onSave,
    onDelete,
    onClose
}) => {
    const maxHours = getMaxHoursForDate(currentDate);
    const [hours, setHours] = useState(currentHours?.toString() || '');
    const [earlyDismissal, setEarlyDismissal] = useState(false);
    const [maintenanceAfter, setMaintenanceAfter] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const h = parseInt(hours);
        if (isNaN(h) || h < 1 || h > maxHours) {
            alert(`Por favor, insira um valor entre 1 e ${maxHours} horas.`);
            return;
        }
        onSave(h, {
            earlyDismissal: resource.type === 'employee' ? earlyDismissal : undefined,
            maintenanceAfter: resource.type === 'machine' ? maintenanceAfter : undefined
        });
    };

    if (maxHours === 0) {
        return (
            <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
                <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                    <div className="modal-header">
                        <h2 style={{ fontSize: '18px', fontWeight: '800' }}>⏱️ Divisão de Horas</h2>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                            <X size={24} />
                        </button>
                    </div>
                    <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                        Esta funcionalidade está disponível apenas para dias úteis (Segunda a Sexta).
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
            <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                <div className="modal-header">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px', fontWeight: '800' }}>
                        <Clock size={22} color="#8b5cf6" /> Divisão de Carga Horária
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ padding: '24px' }}>
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Recurso Selecionado</div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>{resource.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                            {resource.type === 'employee' ? '👤 Funcionário' : '🚜 Máquina'} • {maxHours}h disponíveis neste dia
                        </div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
                                Quantas horas nesta obra?
                            </label>
                            <input
                                type="number"
                                min="1"
                                max={maxHours}
                                step="1"
                                value={hours}
                                onChange={(e) => setHours(e.target.value)}
                                placeholder={`Ex: ${Math.floor(maxHours / 2)}`}
                                autoFocus
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    borderRadius: '12px',
                                    border: '2px solid #e2e8f0',
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    outline: 'none',
                                    transition: 'border-color 0.2s'
                                }}
                            />
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                                Horas remanescentes: {hours ? Math.max(0, maxHours - parseInt(hours)) : maxHours}h
                            </div>
                        </div>

                        {resource.type === 'employee' && (
                            <div style={{ marginBottom: '24px', background: '#eff6ff', padding: '14px', borderRadius: '10px', border: '1px solid #dbeafe' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#1e40af' }}>
                                    <input
                                        type="checkbox"
                                        checked={earlyDismissal}
                                        onChange={(e) => setEarlyDismissal(e.target.checked)}
                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                    />
                                    ✅ Saiu mais cedo (não criar card remanescente)
                                </label>
                                <div style={{ fontSize: '11px', color: '#60a5fa', marginTop: '6px', marginLeft: '28px' }}>
                                    Marque se o funcionário não trabalhou as horas restantes.
                                </div>
                            </div>
                        )}

                        {resource.type === 'machine' && (
                            <div style={{ marginBottom: '24px', background: '#fef3c7', padding: '14px', borderRadius: '10px', border: '1px solid #fde68a' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#92400e' }}>
                                    <input
                                        type="checkbox"
                                        checked={maintenanceAfter}
                                        onChange={(e) => setMaintenanceAfter(e.target.checked)}
                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                    />
                                    🔧 Enviar para Manutenção (card remanescente)
                                </label>
                                <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '6px', marginLeft: '28px' }}>
                                    Marque se a máquina quebrou após este período.
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{ flex: 2, padding: '14px', borderRadius: '12px', fontWeight: '700', background: '#8b5cf6', border: 'none' }}
                            >
                                Salvar Divisão
                            </button>
                            {currentHours && (
                                <button
                                    type="button"
                                    onClick={onDelete}
                                    style={{
                                        flex: 1,
                                        padding: '14px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        background: '#fee2e2',
                                        color: '#dc2626',
                                        fontWeight: '700',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Remover
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
