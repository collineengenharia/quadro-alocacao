import React, { useState } from 'react';
import { Building2, X, Plus, Trash2, Edit2, Save, Eye, EyeOff, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Worksite, Resource } from '../types';

interface WorksiteSettingsProps {
    worksites: Worksite[];
    onAdd: (name: string) => void;
    onDelete: (id: string) => void;
    onRename: (id: string, newName: string) => void;
    onToggleVisibility: (id: string) => void;
    onToggleAllVisibility: (visible: boolean) => void;
    currentDate: Date;
    worksiteVisibility: { [worksiteId: string]: boolean };
    allocationsForDate: { [resourceId: string]: string };
    resources: Resource[];
    onClose: () => void;
}

export const WorksiteSettings: React.FC<WorksiteSettingsProps> = ({
    worksites,
    onAdd,
    onDelete,
    onRename,
    onToggleVisibility,
    onToggleAllVisibility,
    currentDate,
    worksiteVisibility,
    allocationsForDate,
    resources,
    onClose
}) => {
    const [newWorksiteName, setNewWorksiteName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (newWorksiteName.trim()) {
            onAdd(newWorksiteName.trim());
            setNewWorksiteName('');
        }
    };

    const startEditing = (ws: Worksite) => {
        setEditingId(ws.id);
        setEditingName(ws.name);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditingName('');
    };

    const handleSaveRename = (id: string) => {
        if (editingName.trim()) {
            onRename(id, editingName.trim());
            setEditingId(null);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content animate-fade-in">
                <div className="modal-header">
                    <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Building2 size={22} color="#3b82f6" /> Gestão de Obras
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <X size={24} />
                    </button>
                </div>

                <div className="modal-body">
                    <div style={{ padding: '12px 16px', background: '#f0f9ff', borderRadius: '12px', marginBottom: '20px' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: '#0369a1', fontWeight: '700' }}>
                            📅 Visibilidade para: {format(currentDate, "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#075985' }}>As obras visíveis mudam conforme a data selecionada.</p>
                    </div>

                    <form onSubmit={handleAdd} className="input-group">
                        <input
                            type="text"
                            placeholder="Nome da nova obra..."
                            className="input-main"
                            value={newWorksiteName}
                            onChange={(e) => setNewWorksiteName(e.target.value)}
                        />
                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ padding: '10px', borderRadius: '12px' }}
                        >
                            <Plus size={20} />
                        </button>
                    </form>

                    <div style={{ marginTop: '20px' }}>
                        <div style={{ position: 'relative', marginBottom: '16px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '14px', top: '13px', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="Filtrar obras..."
                                style={{
                                    width: '100%',
                                    padding: '12px 12px 12px 42px',
                                    borderRadius: '14px',
                                    border: '1px solid #e2e8f0',
                                    background: '#f8fafc',
                                    outline: 'none',
                                    fontSize: '14px'
                                }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            <button
                                onClick={() => onToggleAllVisibility(true)}
                                style={{ flex: 1, padding: '8px', fontSize: '11px', fontWeight: '800', background: '#ecfdf5', color: '#059669', border: '1px solid #10b981', borderRadius: '10px', cursor: 'pointer' }}
                            >
                                ✅ MOSTRAR TODAS OBRAS
                            </button>
                            <button
                                onClick={() => onToggleAllVisibility(false)}
                                style={{ flex: 1, padding: '8px', fontSize: '11px', fontWeight: '800', background: '#fff1f2', color: '#e11d48', border: '1px solid #f43f5e', borderRadius: '10px', cursor: 'pointer' }}
                            >
                                🚫 OCULTAR TODAS OBRAS
                            </button>
                        </div>

                        {worksites
                            .filter(ws => ws.name.toLowerCase().includes(searchTerm.toLowerCase()))
                            .map((ws) => {
                                // Se o estado de visibilidade for indefinido, checamos se tem gente alocada
                                const isVisible = worksiteVisibility[ws.id] ?? (resources && allocationsForDate ? resources.some(r => allocationsForDate[r.id] === ws.id) : false);
                                return (
                                    <div key={ws.id} className="list-item" style={{
                                        opacity: !isVisible ? 0.6 : 1,
                                        transition: 'opacity 0.2s'
                                    }}>
                                        <div className={`bg-obra-circle`} style={{
                                            width: '12px',
                                            height: '12px',
                                            borderRadius: '50%',
                                            backgroundColor: ws.color.startsWith('#') ? ws.color : `var(--${ws.color})`
                                        }} />

                                        {editingId === ws.id ? (
                                            <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
                                                <input
                                                    className="input-main"
                                                    style={{ padding: '6px 10px', fontSize: '13px' }}
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    autoFocus
                                                />
                                                <button onClick={() => handleSaveRename(ws.id)} style={{ color: '#16a34a', border: 'none', background: 'none', cursor: 'pointer' }}>
                                                    <Save size={18} />
                                                </button>
                                                <button onClick={cancelEditing} style={{ color: '#94a3b8', border: 'none', background: 'none', cursor: 'pointer' }}>
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ flex: 1 }}>
                                                <span style={{ fontWeight: 700, fontSize: '14px', color: !isVisible ? '#94a3b8' : '#334155' }}>
                                                    {ws.name}
                                                    {!isVisible && <span style={{ fontSize: '10px', fontWeight: '500', marginLeft: '8px', color: '#94a3b8' }}>(Oculta)</span>}
                                                </span>
                                            </div>
                                        )}

                                        {!editingId && (
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    onClick={() => onToggleVisibility(ws.id)}
                                                    style={{
                                                        padding: '6px',
                                                        color: !isVisible ? '#94a3b8' : '#3b82f6',
                                                        border: 'none',
                                                        background: 'none',
                                                        cursor: 'pointer'
                                                    }}
                                                    title={!isVisible ? "Mostrar no Quadro" : "Ocultar do Quadro"}
                                                >
                                                    {!isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                                <button onClick={() => startEditing(ws)} style={{ padding: '6px', color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer' }}>
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => onDelete(ws.id)} style={{ padding: '6px', color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        {worksites.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>
                                Nenhuma obra cadastrada.
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ padding: '16px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
                    Dica: Use o ícone de olho para ocultar obras do quadro sem removê-las.
                </div>
            </div>
        </div>
    );
};
