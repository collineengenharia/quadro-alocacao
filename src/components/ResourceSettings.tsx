import React, { useState } from 'react';
import { UserPlus, Tractor, X, Trash2, Upload, Save, Edit2, Plus, Users, Search } from 'lucide-react';

import type { Resource } from '../types';

interface ResourceSettingsProps {
  resources: Resource[];
  onAdd: (resource: Resource) => void;
  onUpdate: (resource: Resource) => void;
  onDelete: (id: string) => void;
  onBulkImport: (text: string) => void;
  onClose: () => void;
}

export const ResourceSettings: React.FC<ResourceSettingsProps> = ({
  resources,
  onAdd,
  onUpdate,
  onDelete,
  onBulkImport,
  onClose
}) => {
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [type, setType] = useState<'employee' | 'machine'>('employee');
  const [cost, setCost] = useState('');
  const [photo, setPhoto] = useState('');
  const [ignoreCost, setIgnoreCost] = useState(false);
  const [isAdministrative, setIsAdministrative] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startAdding = () => {
    setIsAddingNew(true);
    setEditingResource(null);
    setName('');
    setRole('');
    setType('employee');
    setCost('');
    setPhoto('');
    setIgnoreCost(false);
    setIsAdministrative(false);
  };

  const startEditing = (res: Resource) => {
    setEditingResource(res);
    setIsAddingNew(false);
    setName(res.name);
    setRole(res.role);
    setType(res.type);
    setCost(res.costPerDay.toString());
    setPhoto(res.photo);
    setIgnoreCost(res.ignoreCost || false);
    setIsAdministrative(res.isAdministrative || false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !role) return;

    const resourceData: Resource = {
      id: editingResource ? editingResource.id : Date.now().toString(),
      name,
      role,
      type,
      photo: photo || (type === 'employee' ? 'https://via.placeholder.com/150?text=👤' : 'https://via.placeholder.com/150?text=🚜'),
      costPerDay: Number(cost) || 0,
      ignoreCost: ignoreCost,
      isAdministrative: type === 'employee' ? isAdministrative : undefined,
    };

    if (editingResource) {
      onUpdate(resourceData);
    } else {
      onAdd(resourceData);
    }

    setIsAddingNew(false);
    setEditingResource(null);
  };

  const filteredResources = resources.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade-in" style={{ maxWidth: '650px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={22} color="#3b82f6" /> Gestão de Recursos (Ativos)
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body" style={{ minHeight: '400px' }}>
          {(isAddingNew || editingResource) ? (
            <div className="animate-fade-in">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <button onClick={() => { setIsAddingNew(false); setEditingResource(null); }} style={{ background: '#f1f5f9', border: 'none', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#64748b' }}>
                  ← Voltar para Lista
                </button>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                  {editingResource ? '✏️ Editar Recurso' : '➕ Novo Cadastro'}
                </h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="segmented-control" style={{ gridColumn: '1 / -1' }}>
                    <button
                      type="button"
                      onClick={() => setType('employee')}
                      className={`segment-btn ${type === 'employee' ? 'active' : ''}`}
                    >
                      <UserPlus size={18} /> Funcionário
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('machine')}
                      className={`segment-btn ${type === 'machine' ? 'active' : ''}`}
                    >
                      <Tractor size={18} /> Máquina
                    </button>
                  </div>

                  <div className="field">
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Nome / Modelo</label>
                    <input
                      type="text"
                      placeholder="Ex: João Silva ou Escavadeira CAT"
                      className="input-main"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field">
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Cargo / Identificação</label>
                    <input
                      type="text"
                      placeholder="Ex: Mestre de Obras"
                      className="input-main"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field">
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Valor por Dia (R$)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      className="input-main"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Foto de Perfil</label>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden border-2 border-white shadow-md">
                        {photo ? <img src={photo} alt="Preview" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">📸</div>}
                      </div>
                      <label style={{ flex: 1, height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
                        <Upload size={16} /> Carregar
                        <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                      </label>
                    </div>
                  </div>

                  {/* Desconsiderar Custo - Disponível para ambos */}
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#64748b' }}>
                      <input
                        type="checkbox"
                        checked={ignoreCost}
                        onChange={(e) => setIgnoreCost(e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      💰 Desconsiderar Custo (Diária = 0 no Dashboard)
                    </label>
                  </div>

                  {type === 'employee' && (
                    <div className="field" style={{ gridColumn: '1 / -1', marginTop: '-10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#64748b' }}>
                        <input
                          type="checkbox"
                          checked={isAdministrative}
                          onChange={(e) => setIsAdministrative(e.target.checked)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        👔 Funcionário Administrativo
                      </label>
                      <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', marginLeft: '26px' }}>Identificado com selo ADM no quadro.</p>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '32px', gridColumn: '1 / -1' }}>
                  <button type="submit" className="w-full btn btn-primary" style={{ padding: '16px', borderRadius: '16px', fontSize: '16px' }}>
                    <Save size={20} /> {editingResource ? 'Salvar Alterações' : 'Finalizar Cadastro'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="animate-fade-in">
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '14px', top: '13px', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Buscar funcionários ou máquinas..."
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
                <button
                  onClick={startAdding}
                  className="btn btn-primary"
                  style={{ padding: '0 20px', borderRadius: '14px', height: '45px' }}
                >
                  <Plus size={20} /> Novo
                </button>
              </div>

              <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                {filteredResources.map((res) => (
                  <div key={res.id} className="list-item" style={{ padding: '12px' }}>
                    <img src={res.photo} className={`w-12 h-12 rounded-full object-cover border-2 ${res.type === 'employee' ? 'border-blue-100' : 'border-amber-100'}`} alt={res.name} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 800, margin: 0, fontSize: '14px', color: '#1e293b' }}>
                        {res.name}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                        {res.role} • R$ {res.costPerDay}/dia
                        {res.ignoreCost && <span style={{ marginLeft: '4px', fontSize: '10px', color: '#94a3b8' }}>(custo ignorado)</span>}
                        {res.isAdministrative && <span style={{ marginLeft: '4px' }}>👔</span>}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => startEditing(res)} style={{ padding: '8px', color: '#3b82f6', border: 'none', background: '#eff6ff', borderRadius: '8px', cursor: 'pointer' }}>
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => onDelete(res.id)} style={{ padding: '8px', color: '#ef4444', border: 'none', background: '#fef2f2', borderRadius: '8px', cursor: 'pointer' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredResources.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                    <Users size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                    <p style={{ margin: 0, fontStyle: 'italic', fontSize: '14px' }}>Nenhum recurso encontrado.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '16px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', textAlign: 'center' }}>
          <button
            onClick={() => {
              const text = prompt("Cole aqui o conteúdo do arquivo TXT para importação inteligente:");
              if (text) onBulkImport(text);
            }}
            style={{
              background: '#0f172a',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '800',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '0 auto'
            }}
          >
            🚀 Importação Rápida (TXT)
          </button>
          <div style={{ marginTop: '12px', fontSize: '10px', color: '#94a3b8', fontWeight: '500' }}>
            Atenção: Use este botão apenas para a carga inicial de dados.
          </div>
        </div>
      </div>
    </div>
  );
};
