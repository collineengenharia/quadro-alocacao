import React, { useState } from 'react';
import { Fuel, Droplets, Save, Search, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Resource, FuelData, FuelEntry } from '../types';

interface FuelManagerProps {
    resources: Resource[];
    fuelData: FuelData;
    onUpdateFuel: (entry: FuelEntry) => void;
    currentDate: Date;
}

export const FuelManager: React.FC<FuelManagerProps> = ({
    resources,
    fuelData,
    onUpdateFuel,
    currentDate
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
    const [fuelLiters, setFuelLiters] = useState<string>('');
    const [oilLiters, setOilLiters] = useState<string>('');
    const [notes, setNotes] = useState('');

    const dateKey = format(currentDate, 'yyyy-MM-dd');
    const machines = resources.filter(r => r.type === 'machine');

    const filteredMachines = machines.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelectMachine = (machine: Resource) => {
        setSelectedMachineId(machine.id);
        const existing = fuelData[dateKey]?.[machine.id];
        if (existing) {
            setFuelLiters(existing.fuelLiters.toString());
            setOilLiters(existing.oilLiters.toString());
            setNotes(existing.notes || '');
        } else {
            setFuelLiters('');
            setOilLiters('');
            setNotes('');
        }
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMachineId) return;

        onUpdateFuel({
            resourceId: selectedMachineId,
            date: dateKey,
            fuelLiters: parseFloat(fuelLiters) || 0,
            oilLiters: parseFloat(oilLiters) || 0,
            notes
        });

        setSelectedMachineId(null);
    };

    return (
        <div className="animate-fade-in" style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#1e293b' }}>⛽ Gestão de Combustível</h1>
                    <p style={{ color: '#64748b', fontWeight: '600' }}>
                        Lançamento de consumo para maquinário em {format(currentDate, "dd 'de' MMMM", { locale: ptBR })}
                    </p>
                </div>
                <div style={{ position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Buscar máquina..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            padding: '10px 10px 10px 40px',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            width: '250px',
                            fontSize: '14px',
                            outline: 'none',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }}
                    />
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: selectedMachineId ? '1fr 380px' : '1fr', gap: '32px', transition: 'all 0.3s ease-in-out' }}>
                {/* LISTA DE MÁQUINAS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
                    {filteredMachines.map(machine => {
                        const hasData = !!fuelData[dateKey]?.[machine.id];
                        const isSelected = selectedMachineId === machine.id;

                        return (
                            <div
                                key={machine.id}
                                onClick={() => handleSelectMachine(machine)}
                                style={{
                                    background: 'white',
                                    borderRadius: '20px',
                                    padding: '24px',
                                    cursor: 'pointer',
                                    border: isSelected ? '3px solid #3b82f6' : '1px solid #f1f5f9',
                                    boxShadow: isSelected ? '0 10px 15px rgba(59, 130, 246, 0.1)' : '0 4px 6px rgba(0,0,0,0.02)',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    position: 'relative',
                                    transform: isSelected ? 'translateY(-4px)' : 'none'
                                }}
                            >
                                {hasData && (
                                    <div style={{ position: 'absolute', top: '15px', right: '15px', background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '10px', fontSize: '10px', fontWeight: '900', letterSpacing: '0.5px' }}>
                                        LANÇADO
                                    </div>
                                )}
                                <div style={{
                                    width: '56px',
                                    height: '56px',
                                    background: isSelected ? '#eff6ff' : '#f8fafc',
                                    borderRadius: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '20px',
                                    color: isSelected ? '#3b82f6' : '#94a3b8'
                                }}>
                                    <Truck size={28} />
                                </div>
                                <div style={{ fontWeight: '900', color: '#1e293b', fontSize: '16px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {machine.name}
                                </div>
                                <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>{machine.id}</div>

                                {hasData && (
                                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f8fafc', display: 'flex', gap: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#3b82f6', fontWeight: '800' }}>
                                            <Fuel size={14} /> {fuelData[dateKey][machine.id].fuelLiters}L
                                        </div>
                                        {fuelData[dateKey][machine.id].oilLiters > 0 && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8b5cf6', fontWeight: '800' }}>
                                                <Droplets size={14} /> {fuelData[dateKey][machine.id].oilLiters}L
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {filteredMachines.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px', background: '#f8fafc', borderRadius: '24px', border: '2px dashed #e2e8f0', color: '#94a3b8' }}>
                            Nenhuma máquina encontrada.
                        </div>
                    )}
                </div>

                {/* FORMULÁRIO DE LANÇAMENTO */}
                {selectedMachineId && (
                    <div className="animate-slide-in-right" style={{ background: 'white', borderRadius: '28px', padding: '32px', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9', alignSelf: 'start', position: 'sticky', top: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <div>
                                <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b' }}>Detalhes do Consumo</h3>
                                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>MÁQUINA: {resources.find(r => r.id === selectedMachineId)?.name}</span>
                            </div>
                            <button
                                onClick={() => setSelectedMachineId(null)}
                                style={{ background: '#f8fafc', border: 'none', color: '#64748b', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                            >✕</button>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '900', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    Consumo Diesel (Litros)
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Fuel size={20} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#3b82f6' }} />
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={fuelLiters}
                                        onChange={(e) => setFuelLiters(e.target.value)}
                                        style={{ width: '100%', padding: '16px 16px 16px 48px', borderRadius: '16px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '18px', fontWeight: '900', transition: 'border-color 0.2s' }}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '900', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    Consumo Óleo (Litros)
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Droplets size={20} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#8b5cf6' }} />
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={oilLiters}
                                        onChange={(e) => setOilLiters(e.target.value)}
                                        style={{ width: '100%', padding: '16px 16px 16px 48px', borderRadius: '16px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '18px', fontWeight: '900', transition: 'border-color 0.2s' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '900', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    Observações de Operação
                                </label>
                                <textarea
                                    placeholder="Ex: Terreno pesado, quebra de mangueira..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '14px', resize: 'vertical', minHeight: '100px', fontWeight: '600' }}
                                />
                            </div>

                            <button
                                type="submit"
                                style={{
                                    background: '#3b82f6',
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
                                    gap: '12px',
                                    boxShadow: '0 10px 20px rgba(59, 130, 246, 0.25)',
                                    marginTop: '10px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Save size={20} /> Salvar Lançamento
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};
