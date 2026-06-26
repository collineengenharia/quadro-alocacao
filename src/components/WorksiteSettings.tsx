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
    onMergeWorksites?: (sourceIds: string[], targetId: string) => void;
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
    onClose,
    onMergeWorksites
}) => {
    const [newWorksiteName, setNewWorksiteName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const [isMerging, setIsMerging] = useState(false);
    const [mergeSourceIds, setMergeSourceIds] = useState<string[]>([]);
    const [mergeTargetId, setMergeTargetId] = useState<string>('');

    const handleMergeConfirm = () => {
        if (!mergeTargetId || mergeSourceIds.length === 0) return;
        const targetName = worksites.find(w => w.id === mergeTargetId)?.name || '';
        const sourceNames = mergeSourceIds.map(id => worksites.find(w => w.id === id)?.name || '').filter(Boolean).join(', ');
        
        if (confirm(`Tem certeza que deseja unificar as obras "${sourceNames}" na obra "${targetName}"?\n\nEsta ação vai mover todas as alocações passadas para a obra "${targetName}" e remover as obras antigas do cadastro. Não é possível desfazer!`)) {
            if (onMergeWorksites) {
                onMergeWorksites(mergeSourceIds, mergeTargetId);
            }
            setIsMerging(false);
            setMergeSourceIds([]);
            setMergeTargetId('');
        }
    };

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newWorksiteName.trim();
        if (trimmed) {
            const exists = worksites.some(ws => ws.name.toLowerCase() === trimmed.toLowerCase());
            if (exists) {
                alert(`Já existe uma obra cadastrada com o nome "${trimmed}".`);
                return;
            }
            onAdd(trimmed);
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
        const trimmed = editingName.trim();
        if (trimmed) {
            const exists = worksites.some(ws => ws.id !== id && ws.name.toLowerCase() === trimmed.toLowerCase());
            if (exists) {
                alert(`Já existe uma obra cadastrada com o nome "${trimmed}".`);
                return;
            }
            onRename(id, trimmed);
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
                    {isMerging ? (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <button
                                    onClick={() => setIsMerging(false)}
                                    style={{
                                        background: '#f1f5f9',
                                        border: 'none',
                                        padding: '8px 16px',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: '700',
                                        color: '#64748b'
                                    }}
                                >
                                    ← Voltar
                                </button>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>🔗 Unificar Obras</h3>
                            </div>

                            <div style={{ background: '#f0f9ff', padding: '12px 16px', borderRadius: '12px', fontSize: '12px', color: '#0369a1', lineHeight: '1.4' }}>
                                <p style={{ margin: 0, fontWeight: '700' }}>⚠️ Como funciona a fusão:</p>
                                <p style={{ margin: '4px 0 0 0' }}>
                                    Escolha a <strong>obra principal (destino)</strong> e marque as <strong>obras que serão integradas (origem)</strong>.
                                    Todos os registros de operadores, máquinas, horas e observações do passado serão migrados para a obra principal, e as origens serão excluídas.
                                </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                                    1. Selecione a Obra Principal (Destino - Será Mantida)
                                </label>
                                <select
                                    className="input-main"
                                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px' }}
                                    value={mergeTargetId}
                                    onChange={(e) => {
                                        setMergeTargetId(e.target.value);
                                        setMergeSourceIds(prev => prev.filter(id => id !== e.target.value));
                                    }}
                                >
                                    <option value="">-- Escolha a obra principal que vai restar --</option>
                                    {worksites.map(ws => (
                                        <option key={ws.id} value={ws.id}>{ws.name}</option>
                                    ))}
                                </select>
                            </div>

                            {mergeTargetId && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                                        2. Selecione as Obras Duplicadas que serão Unidas e Apagadas (Origem)
                                    </label>
                                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '12px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {worksites
                                            .filter(ws => ws.id !== mergeTargetId)
                                            .map(ws => {
                                                const isChecked = mergeSourceIds.includes(ws.id);
                                                return (
                                                    <label key={ws.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#334155', userSelect: 'none' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setMergeSourceIds(prev => [...prev, ws.id]);
                                                                } else {
                                                                    setMergeSourceIds(prev => prev.filter(id => id !== ws.id));
                                                                }
                                                            }}
                                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                        />
                                                        {ws.name}
                                                    </label>
                                                );
                                            })}
                                        {worksites.filter(ws => ws.id !== mergeTargetId).length === 0 && (
                                            <p style={{ margin: 0, fontStyle: 'italic', fontSize: '12px', color: '#94a3b8' }}>Não há outras obras para unificar.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleMergeConfirm}
                                disabled={!mergeTargetId || mergeSourceIds.length === 0}
                                className="btn btn-primary"
                                style={{
                                    padding: '14px',
                                    borderRadius: '12px',
                                    marginTop: '8px',
                                    background: (!mergeTargetId || mergeSourceIds.length === 0) ? '#cbd5e1' : '#10b981',
                                    borderColor: (!mergeTargetId || mergeSourceIds.length === 0) ? '#cbd5e1' : '#10b981',
                                    color: 'white',
                                    fontWeight: '800',
                                    fontSize: '14px',
                                    cursor: (!mergeTargetId || mergeSourceIds.length === 0) ? 'not-allowed' : 'pointer',
                                    transition: 'background 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                🔗 Confirmar e Unificar Obras
                            </button>
                        </div>
                    ) : (
                        <>
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

                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
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

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsMerging(true);
                                        setMergeSourceIds([]);
                                        setMergeTargetId('');
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        background: '#f8fafc',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '800',
                                        color: '#475569',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        marginBottom: '16px',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                    onMouseOut={(e) => e.currentTarget.style.background = '#f8fafc'}
                                >
                                    🔗 Unificar Obras (Mesclar)
                                </button>

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
                        </>
                    )}
                </div>

                <div style={{ padding: '16px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
                    Dica: Use o ícone de olho para ocultar obras do quadro sem removê-las.
                </div>
            </div>
        </div>
    );
};
