import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  PieChart as PieChartIcon,
  Upload,
  FileJson,
  Camera,
  Settings,
  Building2,
  Users,
  X,
  Fuel as FuelIcon,
  Trash2,
  LogOut
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';
import { supabase } from './lib/supabase';
import { useAuth } from './contexts/AuthContext';
import { ResourceSettings } from './components/ResourceSettings';
import { AnalyticalDashboard } from './components/AnalyticalDashboard';
import { WorksiteSettings } from './components/WorksiteSettings';
import { HourSplitModal } from './components/HourSplitModal';
import { FuelManager } from './components/FuelManager';

import type { Resource, Worksite, OvertimeData, OvertimeEntry, ResourceLinks, MaintenanceData, MaintenanceEntry, PartialAllocationsData, FuelData, FuelEntry, FuelQuoteData } from './types';

interface AllocationData {
  [dateKey: string]: { [resourceId: string]: string };
}

interface WorksiteVisibilityData {
  [dateKey: string]: { [worksiteId: string]: boolean };
}

interface AllocationMetadata {
  [dateKey: string]: {
    isFinalAllocation?: boolean;
    observations?: string;
  };
}

interface ObservationsData {
  [date: string]: {
    [workSiteId: string]: string;
  }
}



const DEFAULT_WORKSITES: Worksite[] = [
  { id: 'obra-1', name: 'Edifício Horizonte', color: 'obra-1', visible: true },
  { id: 'obra-2', name: 'Vila das Flores', color: 'obra-2', visible: true },
  { id: 'obra-3', name: 'Rodovia Sul', color: 'obra-3', visible: true },
  { id: 'obra-4', name: 'Shopping Novo', color: 'obra-4', visible: true },
  { id: 'obra-5', name: 'Complexo Industrial', color: 'obra-5', visible: true },
];

const ResourceCard = ({ resource, onDragStart, onDragEnd, onClick, isSelected, onToggleMaintenance, onOvertime, hasOvertime, linkedResource, inMaintenance, onHourSplit, allocatedHours, dragId }: {
  resource: Resource,
  onDragStart: (e: React.DragEvent, id: string) => void,
  onDragEnd: (e: React.DragEvent) => void,
  onClick?: () => void,
  isSelected?: boolean,
  onToggleMaintenance?: (id: string) => void,
  onOvertime?: (id: string) => void,
  hasOvertime?: boolean,
  linkedResource?: Resource,
  inMaintenance?: boolean,
  onHourSplit?: (id: string) => void,
  allocatedHours?: number,
  dragId?: string
}) => {

  const isDraggable = (!inMaintenance) || (!!dragId);

  return (
    <div
      draggable={isDraggable}
      onDragStart={(e) => isDraggable && onDragStart(e, dragId || resource.id)}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        e.stopPropagation();
        if (!inMaintenance) onClick?.();
      }}
      className={`resource - card animate - scale -in ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''} ${inMaintenance ? 'in-maintenance' : ''} `}
      style={{
        cursor: isDraggable ? 'grab' : 'not-allowed',
        position: 'relative',
        opacity: inMaintenance && !dragId ? 0.7 : 1 // Menor opacidade apenas se bloqueado de verdade
      }}
    >
      {resource.type === 'machine' && onToggleMaintenance && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMaintenance(resource.id);
          }}
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            background: inMaintenance ? '#fb923c' : '#f1f5f9',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 6px',
            cursor: 'pointer',
            fontSize: '14px',
            zIndex: 10,
            transition: 'all 0.2s'
          }}
          title={inMaintenance ? "Retornar ao Serviço" : "Marcar em Manutenção"}
        >
          🔧
        </button>
      )}

      {/* Botão de Divisão de Horas (Esquerda Superior) */}
      {!inMaintenance && onHourSplit && (
        allocatedHours ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onHourSplit(resource.id);
            }}
            style={{
              position: 'absolute',
              top: '4px',
              left: '4px',
              background: 'rgba(139, 92, 246, 0.9)',
              color: 'white',
              borderRadius: '8px',
              padding: '2px 6px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              zIndex: 10,
              boxShadow: '0 2px 4px rgba(139, 92, 246, 0.3)'
            }}
            title="Editar Carga Horária"
          >
            {allocatedHours}h
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onHourSplit(resource.id);
            }}
            style={{
              position: 'absolute',
              top: '4px',
              left: '4px',
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 6px',
              cursor: 'pointer',
              fontSize: '14px',
              zIndex: 10,
              transition: 'all 0.2s',
              color: '#8b5cf6'
            }}
            title="Dividir Carga Horária"
          >
            ⏱️
          </button>
        )
      )}

      {resource.type === 'employee' && onOvertime && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOvertime(resource.id);
          }}
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            background: hasOvertime ? '#3b82f6' : '#f1f5f9',
            color: hasOvertime ? 'white' : '#64748b',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 6px',
            cursor: 'pointer',
            fontSize: '14px',
            zIndex: 10,
            transition: 'all 0.2s',
            boxShadow: hasOvertime ? '0 2px 6px rgba(59, 130, 246, 0.4)' : 'none'
          }}
          title="Lançar Horas Extras"
        >
          {hasOvertime ? '💲' : '💲'}
        </button>
      )}
      {inMaintenance && (
        <div style={{
          position: 'absolute',
          top: '28px',
          right: '4px',
          background: '#fb923c',
          color: 'white',
          fontSize: '8px',
          padding: '2px 4px',
          borderRadius: '4px',
          fontWeight: '800',
          zIndex: 10
        }}>
          MANUTENÇÃO
        </div>
      )}
      {resource.isAdministrative && (
        <div style={{
          position: 'absolute',
          top: '4px',
          left: '4px',
          background: '#64748b',
          color: 'white',
          fontSize: '8px',
          padding: '2px 4px',
          borderRadius: '4px',
          fontWeight: '800',
          zIndex: 10
        }}>
          ADM
        </div>
      )}
      <img
        src={resource.photo}
        alt={resource.name}
        className={`resource - card - photo ${resource.type} `}
      />
      <div className="resource-card-name">{resource.name}</div>
      <div className="resource-card-role">{resource.role}</div>

      {resource.type === 'machine' && linkedResource && (
        <div style={{
          marginTop: '6px',
          paddingTop: '6px',
          borderTop: '1px solid #e2e8f0',
          fontSize: '10px',
          fontWeight: '700',
          color: '#3b82f6',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          👤 {linkedResource.name}
        </div>
      )}
    </div>
  );
}

const OvertimeModal = ({ resource, currentOvertime, onSave, onDelete, onClose }: {
  resource: Resource,
  currentOvertime?: OvertimeEntry,
  onSave: (entry: OvertimeEntry) => void,
  onDelete: () => void,
  onClose: () => void
}) => {
  const [hours, setHours] = useState(currentOvertime?.hours.toString() || '');
  const [multiplier, setMultiplier] = useState<1.5 | 2.0>(currentOvertime?.multiplier || 1.5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseFloat(hours);
    if (isNaN(h) || h <= 0) return;
    onSave({ hours: h, multiplier });
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '20px', fontWeight: '800' }}>
            ⌚ Horas Extras: {resource.name}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ marginTop: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
              Quantidade de Horas
            </label>
            <input
              type="number"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Ex: 2 ou 2.5"
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '2px solid #e2e8f0',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
              Tipo de Adicional
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setMultiplier(1.5)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: '2px solid',
                  borderColor: multiplier === 1.5 ? '#3b82f6' : '#e2e8f0',
                  background: multiplier === 1.5 ? '#eff6ff' : 'white',
                  color: multiplier === 1.5 ? '#1d4ed8' : '#64748b',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                50% (Normal)
              </button>
              <button
                type="button"
                onClick={() => setMultiplier(2.0)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: '2px solid',
                  borderColor: multiplier === 2.0 ? '#ef4444' : '#e2e8f0',
                  background: multiplier === 2.0 ? '#fef2f2' : 'white',
                  color: multiplier === 2.0 ? '#dc2626' : '#64748b',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                100% (Fer./Dom.)
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 2, padding: '14px', borderRadius: '12px', fontWeight: '700' }}
            >
              Salvar Lançamento
            </button>
            {currentOvertime && (
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
  );
};

function App() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'board' | 'analytics' | 'fuel'>('board');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [resources, setResources] = useState<Resource[]>([]);
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [allocations, setAllocations] = useState<AllocationData>({});
  const [observations, setObservations] = useState<ObservationsData>({});
  const [worksiteVisibility, setWorksiteVisibility] = useState<WorksiteVisibilityData>({});
  const [allocationMetadata, setAllocationMetadata] = useState<AllocationMetadata>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showWorksiteSettings, setShowWorksiteSettings] = useState(false);
  const [showResourceSettings, setShowResourceSettings] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<{
    allocations: { [resourceId: string]: string };
    observations: { [workSiteId: string]: string };
    visibility: { [workSiteId: string]: boolean };
    links: { [machineId: string]: string };
    overtime: { [resourceId: string]: OvertimeEntry };
    partialAllocations: { [resourceId: string]: any[] };
  } | null>(null);
  const [overtime, setOvertime] = useState<OvertimeData>({});
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [overtimeResourceId, setOvertimeResourceId] = useState<string | null>(null);
  const [resourceLinks, setResourceLinks] = useState<ResourceLinks>({});
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceData>({});
  const [partialAllocations, setPartialAllocations] = useState<PartialAllocationsData>({});
  const [showHourSplitModal, setShowHourSplitModal] = useState(false);
  const [hourSplitResourceId, setHourSplitResourceId] = useState<string | null>(null);

  const [fuelData, setFuelData] = useState<FuelData>({});
  const [fuelQuotes, setFuelQuotes] = useState<FuelQuoteData>({});

  const boardRef = useRef<HTMLDivElement>(null);

  const [dataLoaded, setDataLoaded] = useState(false);

  // === CARREGAR DADOS DO SUPABASE ===
  useEffect(() => {
    if (!user) return;

    const loadFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('app_state')
          .select('state')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          // PGRST116 = nenhuma linha (usuário novo) — normal
          console.error('Erro ao carregar do Supabase:', error);
        }

        if (data?.state) {
          const s = data.state;
          if (Array.isArray(s.resources)) setResources(s.resources);
          if (Array.isArray(s.worksites) && s.worksites.length > 0) setWorksites(s.worksites);
          else setWorksites(DEFAULT_WORKSITES);
          if (s.allocations) setAllocations(s.allocations);
          if (s.observations) setObservations(s.observations);
          if (s.worksiteVisibility) setWorksiteVisibility(s.worksiteVisibility);
          if (s.allocationMetadata) setAllocationMetadata(s.allocationMetadata);
          if (s.overtime) setOvertime(s.overtime);
          if (s.resourceLinks) setResourceLinks(s.resourceLinks);
          if (s.maintenanceHistory) setMaintenanceHistory(s.maintenanceHistory);
          if (s.partialAllocations) setPartialAllocations(s.partialAllocations);
          if (s.fuelData) setFuelData(s.fuelData);
          if (s.fuelQuotes) setFuelQuotes(s.fuelQuotes);
        } else {
          // Usuário novo: carregar dados do localStorage como migração
          try {
            const savedResources = localStorage.getItem('colline_resources');
            const savedWorksites = localStorage.getItem('colline_worksites');
            const savedAllocations = localStorage.getItem('colline_history');
            const savedObservations = localStorage.getItem('colline_observations');
            const savedWorksiteVisibility = localStorage.getItem('colline_worksite_visibility');
            const savedMetadata = localStorage.getItem('colline_allocation_metadata');
            const savedOvertime = localStorage.getItem('colline_overtime');
            const savedLinks = localStorage.getItem('colline_resource_links');
            const savedMaintenance = localStorage.getItem('colline_maintenance');
            const savedPartialAllocations = localStorage.getItem('colline_partial_allocations');
            const savedFuel = localStorage.getItem('colline_fuel_data');
            const savedFuelQuotes = localStorage.getItem('colline_fuel_quotes');

            if (savedResources) { const p = JSON.parse(savedResources); if (Array.isArray(p)) setResources(p); }
            if (savedWorksites) { const p = JSON.parse(savedWorksites); if (Array.isArray(p) && p.length > 0) setWorksites(p); else setWorksites(DEFAULT_WORKSITES); }
            else setWorksites(DEFAULT_WORKSITES);
            if (savedAllocations) { const p = JSON.parse(savedAllocations); if (p && typeof p === 'object') setAllocations(p); }
            if (savedObservations) { const p = JSON.parse(savedObservations); if (p && typeof p === 'object') setObservations(p); }
            if (savedWorksiteVisibility) { const p = JSON.parse(savedWorksiteVisibility); if (p && typeof p === 'object') setWorksiteVisibility(p); }
            if (savedMetadata) { const p = JSON.parse(savedMetadata); if (p && typeof p === 'object') setAllocationMetadata(p); }
            if (savedOvertime) { const p = JSON.parse(savedOvertime); if (p && typeof p === 'object') setOvertime(p); }
            if (savedLinks) { const p = JSON.parse(savedLinks); if (p && typeof p === 'object') setResourceLinks(p); }
            if (savedMaintenance) { const p = JSON.parse(savedMaintenance); if (p && typeof p === 'object') setMaintenanceHistory(p); }
            if (savedPartialAllocations) { const p = JSON.parse(savedPartialAllocations); if (p && typeof p === 'object') setPartialAllocations(p); }
            if (savedFuel) { const p = JSON.parse(savedFuel); if (p && typeof p === 'object') setFuelData(p); }
            if (savedFuelQuotes) { const p = JSON.parse(savedFuelQuotes); if (p && typeof p === 'object') setFuelQuotes(p); }
          } catch (localErr) {
            console.error('Erro ao carregar do localStorage:', localErr);
          }
        }
      } catch (err) {
        console.error('Erro geral ao carregar dados:', err);
      } finally {
        setDataLoaded(true);
      }
    };

    loadFromSupabase();

    // === INÍCIO MÓDULO REAL-TIME ===
    // Configura um ouvinte para o Supabase. Quando qualquer mudança acontecer no banco,
    // (de outras abas do mesmo usuário), o aplicativo vai baixar e atualizar a tela sozinho.
    const subscription = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Escuta INSERT e UPDATE
          schema: 'public',
          table: 'app_state',
          filter: `user_id=eq.${user.id}`
        },
        (payload: any) => {
          console.log('🔄 Atualização Real-time Recebida!', payload);
          if (payload.new && payload.new.state) {
            const s = payload.new.state as any;
            if (Array.isArray(s.resources)) setResources(s.resources);
            if (Array.isArray(s.worksites) && s.worksites.length > 0) setWorksites(s.worksites);
            if (s.allocations) setAllocations(s.allocations);
            if (s.observations) setObservations(s.observations);
            if (s.worksiteVisibility) setWorksiteVisibility(s.worksiteVisibility);
            if (s.allocationMetadata) setAllocationMetadata(s.allocationMetadata);
            if (s.overtime) setOvertime(s.overtime);
            if (s.resourceLinks) setResourceLinks(s.resourceLinks);
            if (s.maintenanceHistory) setMaintenanceHistory(s.maintenanceHistory);
            if (s.partialAllocations) setPartialAllocations(s.partialAllocations);
            if (s.fuelData) setFuelData(s.fuelData);
            if (s.fuelQuotes) setFuelQuotes(s.fuelQuotes);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('🔗 Conectado ao Real-time do Supabase!');
        }
      });

    // Limpeza da subscription quando o componente desmonta ou o usuário muda
    return () => {
      supabase.removeChannel(subscription);
    };
    // === FIM MÓDULO REAL-TIME ===

  }, [user]);

  // === SALVAR DADOS NO SUPABASE (com debounce de 2s para evitar muitas requisições) ===
  useEffect(() => {
    if (!user || !dataLoaded) return;

    const timer = setTimeout(async () => {
      const state = {
        resources, worksites, allocations, observations,
        worksiteVisibility, allocationMetadata, overtime,
        resourceLinks, maintenanceHistory, partialAllocations,
        fuelData, fuelQuotes,
      };

      const { error } = await supabase
        .from('app_state')
        .upsert({ user_id: user.id, state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

      if (error) console.error('Erro ao salvar no Supabase:', error);
    }, 2000);

    return () => clearTimeout(timer);
  }, [user, dataLoaded, resources, worksites, allocations, observations, worksiteVisibility, allocationMetadata, overtime, resourceLinks, maintenanceHistory, partialAllocations, fuelData, fuelQuotes]);

  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const currentAllocations = allocations[dateKey] || {};
  const currentObservations = observations[dateKey] || {};
  const currentMetadata = allocationMetadata[dateKey] || {};

  const isWorksiteVisible = (siteId: string) => {
    // 1. Verificar se há visibilidade explícita salva
    const explicit = worksiteVisibility[dateKey]?.[siteId];
    if (explicit !== undefined) return explicit;

    // 2. Se não houver, verificar se há recursos alocados
    const hasAllocations = resources.some(res => currentAllocations[res.id] === siteId);
    return hasAllocations; // Se tem gente, abre. Se não tem, começa fechada.
  };

  // LÓGICA STICKY: Manutenção persiste até alocação real ou desmarcação manual
  const getResourceMaintenanceStatus = (resourceId: string, targetDateKey: string): MaintenanceEntry | boolean => {
    let lastState: MaintenanceEntry | boolean = false;
    let lastDate: string | null = null;

    // 1. Acha a última ação manual de manutenção registrada até hoje
    const maintDates = Object.keys(maintenanceHistory).filter(d => d <= targetDateKey).sort();
    for (const date of maintDates) {
      const entry = maintenanceHistory[date]?.[resourceId];
      if (entry !== undefined) {
        lastState = entry;
        lastDate = date;
      }
    }

    const isInMaint = typeof lastState === 'object' ? lastState.inMaintenance : lastState;
    if (!isInMaint || !lastDate) return false;

    // 2. Verifica se houve alguma alocação para OBRA depois desse registro
    const allocDates = Object.keys(allocations).filter(d => d > lastDate && d <= targetDateKey);
    for (const d of allocDates) {
      const loc = allocations[d]?.[resourceId];
      if (loc && loc !== 'pateo' && loc !== 'chuva') return false;
    }

    const partialDates = Object.keys(partialAllocations).filter(d => d > lastDate && d <= targetDateKey);
    for (const d of partialDates) {
      const parts = partialAllocations[d]?.[resourceId] || [];
      if (parts.some(p => p.worksiteId !== 'pateo' && p.worksiteId !== 'chuva')) return false;
    }

    return lastState;
  };

  const isResourceInMaintenance = (resourceId: string, targetDateKey: string): boolean => {
    const status = getResourceMaintenanceStatus(resourceId, targetDateKey);
    return typeof status === 'object' ? status.inMaintenance : status;
  };

  // -- Gestão de Obras --
  const handleAddWorksite = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    // CORREÇÃO: Impedir nomes duplicados (ignorando maiúsculas/minúsculas)
    if (worksites.some(ws => ws.name.toLowerCase() === trimmed.toLowerCase())) {
      console.warn(`Obra duplicada ignorada: ${trimmed}`);
      return;
    }

    const colorIndex = (worksites.length % 5) + 1;
    const newWs: Worksite = {
      id: `obra-${Date.now()}`,
      name: trimmed,
      color: `obra-${colorIndex}`,
      visible: true
    };
    setWorksites([...worksites, newWs]);
  };

  const handleDeleteWorksite = (id: string) => {
    if (!confirm("Ao excluir esta obra, todas as alocações vinculadas serão removidas do histórico. Confirmar?")) return;
    setWorksites(worksites.filter(w => w.id !== id));

    const newAllocations = { ...allocations };
    Object.keys(newAllocations).forEach(date => {
      Object.keys(newAllocations[date]).forEach(resId => {
        if (newAllocations[date][resId] === id) {
          delete newAllocations[date][resId];
        }
      });
    });
    setAllocations(newAllocations);
  };

  const handleRenameWorksite = (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    // CORREÇÃO: Impedir renomear para um nome já existente
    if (worksites.some(ws => ws.id !== id && ws.name.toLowerCase() === trimmed.toLowerCase())) {
      console.warn(`Tentativa de renomear para obra duplicada ignorada: ${trimmed}`);
      return;
    }

    setWorksites(worksites.map(w => w.id === id ? { ...w, name: trimmed } : w));
  };

  const handleToggleWorksiteVisibility = (id: string) => {
    // Verificar se a obra tem recursos alocados antes de ocultar
    const isCurrentlyVisible = worksiteVisibility[dateKey]?.[id] ?? false;

    if (isCurrentlyVisible) {
      // Tentando ocultar - verificar se tem recursos alocados
      const allocatedResources = resources.filter(res => currentAllocations[res.id] === id);

      if (allocatedResources.length > 0) {
        const resourceNames = allocatedResources.map(r => r.name).join(', ');
        alert(`\u26a0\ufe0f N\u00e3o \u00e9 poss\u00edvel ocultar esta obra!\n\nRecursos alocados: ${resourceNames} \n\nRemova todos os recursos desta obra antes de ocult\u00e1 - la.`);
        return;
      }
    }

    setWorksiteVisibility(prev => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        [id]: !isCurrentlyVisible
      }
    }));
  };

  const handleUpdateFuel = (entry: FuelEntry) => {
    setFuelData(prev => ({
      ...prev,
      [entry.date]: {
        ...(prev[entry.date] || {}),
        [entry.resourceId]: entry
      }
    }));
  };

  const handleToggleFinalAllocation = () => {
    setAllocationMetadata(prev => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        isFinalAllocation: !prev[dateKey]?.isFinalAllocation
      }
    }));
  };

  const handleCopyBoard = () => {
    setClipboard({
      allocations: { ...(allocations[dateKey] || {}) },
      observations: { ...(observations[dateKey] || {}) },
      visibility: { ...(worksiteVisibility[dateKey] || {}) },
      links: { ...(resourceLinks[dateKey] || {}) },
      overtime: { ...(overtime[dateKey] || {}) },
      partialAllocations: { ...(partialAllocations[dateKey] || {}) }
    });
    alert('📋 Quadro copiado! Vá para outro dia e clique em "Colar".');
  };

  const handlePasteBoard = () => {
    if (!clipboard) {
      alert('⚠️ Nenhum quadro copiado ainda!');
      return;
    }

    const confirm = window.confirm(`📥 Colar quadro copiado nesta data ?\n\nIsso substituirá as alocações e observações atuais.`);
    if (!confirm) return;

    // Ajuste para Sexta-feira (Máximo 8h)
    let finalPartials = { ...clipboard.partialAllocations };
    const maxHours = getMaxHoursForDate(currentDate);

    if (maxHours < 9) { // É sexta ou fim de semana (mas assumindo sexta como alvo principal de ajuste)
      const adjustedPartials: PartialAllocationsData[string] = {};

      Object.keys(finalPartials).forEach(resId => {
        const parts = [...finalPartials[resId]];
        const totalHours = parts.reduce((acc, p) => acc + p.hours, 0);

        if (totalHours > maxHours) {
          // REDUZIR 1 HORA (Cenário: 9h -> 8h)
          // Encontrar card com menor hora (que seja > 1 para não zerar) para reduzir
          let targetIdx = -1;
          let minHours = 999;

          parts.forEach((p, idx) => {
            if (p.hours > 0 && p.hours <= minHours) {
              minHours = p.hours;
              targetIdx = idx;
            }
          });

          if (targetIdx !== -1) {
            const diff = totalHours - maxHours;
            if (parts[targetIdx].hours > diff) {
              parts[targetIdx] = { ...parts[targetIdx], hours: parts[targetIdx].hours - diff };
            }
          }
        }
        adjustedPartials[resId] = parts;
      });
      finalPartials = adjustedPartials;
    } else {
      // É dia de semana (9h) - Verificar se veio de uma sexta (8h)
      const adjustedPartials: PartialAllocationsData[string] = {};

      Object.keys(finalPartials).forEach(resId => {
        const parts = [...finalPartials[resId]];
        const totalHours = parts.reduce((acc, p) => acc + p.hours, 0);

        // Se o total for menor que o máximo (ex: veio 8h e o dia é 9h), adicionar a diferença
        if (totalHours > 0 && totalHours < maxHours) {
          // ADICIONAR 1 HORA (Cenário: 8h -> 9h)
          // Adicionar ao card de MENOR hora para distribuir melhor
          let targetIdx = -1;
          let minHours = 999;

          parts.forEach((p, idx) => {
            if (p.hours > 0 && p.hours <= minHours) {
              minHours = p.hours;
              targetIdx = idx;
            }
          });

          if (targetIdx !== -1) {
            const diff = maxHours - totalHours;
            parts[targetIdx] = { ...parts[targetIdx], hours: parts[targetIdx].hours + diff };
          }
        }
        adjustedPartials[resId] = parts;
      });
      finalPartials = adjustedPartials;
    }

    setAllocations(prev => ({ ...prev, [dateKey]: { ...clipboard.allocations } }));
    setObservations(prev => ({ ...prev, [dateKey]: { ...clipboard.observations } }));
    setWorksiteVisibility(prev => ({ ...prev, [dateKey]: { ...clipboard.visibility } }));
    setResourceLinks(prev => ({ ...prev, [dateKey]: { ...clipboard.links } }));
    setOvertime(prev => ({ ...prev, [dateKey]: { ...clipboard.overtime } }));
    setPartialAllocations(prev => ({ ...prev, [dateKey]: finalPartials }));

    alert('✅ Quadro colado com sucesso!');
  };

  const handleToggleAllWorksites = (visible: boolean) => {
    const updates: { [key: string]: boolean } = {};
    worksites.forEach(ws => {
      updates[ws.id] = visible;
    });
    setWorksiteVisibility(prev => ({
      ...prev,
      [dateKey]: updates
    }));
  };

  // -- Gestão de Recursos --
  const handleAddResource = (res: Resource) => setResources([...resources, res]);
  const handleUpdateResource = (updatedRes: Resource) => {
    setResources(resources.map(r => r.id === updatedRes.id ? updatedRes : r));
  };
  const handleDeleteResource = (id: string) => {
    if (!confirm("Deseja realmente excluir este recurso?")) return;
    setResources(resources.filter(r => r.id !== id));
  };

  const getMaxHoursForDate = (date: Date): number => {
    const dayOfWeek = date.getDay(); // 0 = Domingo, 5 = Sexta
    if (dayOfWeek === 0 || dayOfWeek === 6) return 0;
    return dayOfWeek === 5 ? 8 : 9;
  };

  const handleHourSplit = (resourceId: string) => {
    setHourSplitResourceId(resourceId);
    setShowHourSplitModal(true);
  };

  const handleSaveHourSplit = (hours: number, options: { earlyDismissal?: boolean, maintenanceAfter?: boolean }) => {
    if (!hourSplitResourceId) return;

    const resource = resources.find(r => r.id === hourSplitResourceId);
    if (!resource) return;

    const currentSiteId = currentAllocations[hourSplitResourceId] || 'pateo';
    const maxHours = getMaxHoursForDate(currentDate);
    const remainingHours = maxHours - hours;

    // Criar alocação parcial principal
    const newPartials: import('./types').PartialAllocation[] = [
      {
        resourceId: hourSplitResourceId,
        worksiteId: currentSiteId,
        hours: hours,
      }
    ];

    // Lidar com horas restantes
    if (remainingHours > 0 && !options.earlyDismissal) {
      newPartials.push({
        resourceId: hourSplitResourceId,
        worksiteId: 'pateo',
        hours: remainingHours,
        maintenanceAfter: options.maintenanceAfter
      });

      // Se for máquina e tiver manutenção, ativar status de manutenção
      if (resource.type === 'machine' && options.maintenanceAfter) {
        setMaintenanceHistory(prev => ({
          ...prev,
          [dateKey]: {
            ...(prev[dateKey] || {}),
            [hourSplitResourceId]: { inMaintenance: true, reason: 'Manutenção Pós-Turno' }
          }
        }));
      }
    }

    setPartialAllocations(prev => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        [hourSplitResourceId]: newPartials
      }
    }));

    setShowHourSplitModal(false);
    setHourSplitResourceId(null);
  };

  const handleDeleteHourSplit = () => {
    if (!hourSplitResourceId) return;

    // Remover do estado de parciais
    setPartialAllocations(prev => {
      const newState = { ...prev };
      if (newState[dateKey]) {
        delete newState[dateKey][hourSplitResourceId];
      }
      return newState;
    });

    setShowHourSplitModal(false);
    setHourSplitResourceId(null);
  };

  const handleToggleMaintenance = (resourceId: string) => {
    const currentStatus = getResourceMaintenanceStatus(resourceId, dateKey);
    const currentlyInMaintenance = typeof currentStatus === 'object' ? currentStatus.inMaintenance : currentStatus;

    let reason = '';

    if (!currentlyInMaintenance) {
      const input = window.prompt("Motivo da Manutenção (Opcional):");
      if (input === null) return; // Cancelou
      reason = input;
    }

    const newEntry: MaintenanceEntry = {
      inMaintenance: !currentlyInMaintenance,
      reason: !currentlyInMaintenance ? reason : undefined
    };

    setMaintenanceHistory(prev => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        [resourceId]: newEntry
      }
    }));

    // Nota: Máquinas em manutenção não precisam estar "alocadas" ao pátio
    // A visualização no pátio será automática via renderização condicional
  };

  // Helper para renderização
  const getResourcesForSite = (siteId: string) => {
    return resources
      .filter(res => {
        // Filtragem de demissão:
        // Se o recurso foi demitido, ele só aparece se a data atual (dateKey) for ANTERIOR à data de demissão.
        // Se não tiver data de demissão, aparece sempre.
        if (res.dismissedAt && dateKey >= res.dismissedAt) {
          return false;
        }
        return true;
      })
      .flatMap<{ resource: Resource; allocatedHours: number | undefined; key: string; dragId?: string; inMaintenance?: boolean }>(res => {
        // 1. Verificar parciais
        const partials = partialAllocations[dateKey]?.[res.id];
        if (partials && partials.length > 0) {
          return partials
            .map((p, originalIndex) => ({ ...p, originalIndex })) // Preservar índice original
            .filter(p => p.worksiteId === siteId)
            .map((p) => ({
              resource: res,
              allocatedHours: p.hours,
              key: `${res.id} -part - ${p.originalIndex} `,
              dragId: `partial:${res.id}:${p.originalIndex} `, // ID com índice correto
              inMaintenance: !!p.maintenanceAfter
            }));
        }

        // 2. Fallback para alocação padrão
        const allocatedSite = currentAllocations[res.id] || 'pateo';
        // Se siteId é pateo, e não tem alocação (allocatedSite é pateo), então deve aparecer
        // Se siteId é obra-X, e allocatedSite é obra-X, deve aparecer
        if (allocatedSite === siteId) {
          return [{
            resource: res,
            allocatedHours: undefined, // Full day
            key: res.id
          }];
        }

        return [];
      });
  };

  const handleBulkImport = (text: string) => {
    const lines = text.split('\n');
    let currentSection = '';
    const newResources: Resource[] = [];
    const newWorksites: Worksite[] = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed === 'Funcionários') { currentSection = 'employees'; return; }
      if (trimmed === 'Maquinas') { currentSection = 'machines'; return; }
      if (trimmed === 'Obras') { currentSection = 'worksites'; return; }

      try {
        if (currentSection === 'employees') {
          // Format: Name  Role  Value (R$ 416,10)
          const parts = trimmed.split(/\t| {2,}/);
          if (parts.length >= 2) {
            const name = parts[0].trim();
            const role = parts[1].trim();
            const valueStr = parts[2] ? parts[2].replace('R$', '').replace('.', '').replace(',', '.').trim() : '0';
            newResources.push({
              id: `res - ${Date.now()} -${Math.random()} `,
              name,
              type: 'employee',
              role,
              photo: `https://via.placeholder.com/150?text=${name.charAt(0)}`,
              costPerDay: parseFloat(valueStr) || 0
            });
          }
        } else if (currentSection === 'machines') {
          // Format: Name  unit  value
          const parts = trimmed.split(/\t| {2,}/);
          if (parts.length >= 2) {
            const name = parts[0].trim();
            const unit = parts[1].trim();
            const valueStr = parts[2] ? parts[2].replace('R$', '').replace('.', '').replace(',', '.').trim() : '0';
            newResources.push({
              id: `res-${Date.now()}-${Math.random()}`,
              name,
              type: 'machine',
              role: unit === 'dia' ? 'Diário' : unit,
              photo: `https://via.placeholder.com/150?text=🚜`,
              costPerDay: parseFloat(valueStr) || 0
            });
          }
        } else if (currentSection === 'worksites') {
          if (trimmed !== 'Nome' && trimmed !== 'unidade' && trimmed !== 'valor' && trimmed !== 'Função' && trimmed !== 'Valor dia') {
            newWorksites.push({
              id: `obra-${Date.now()}-${Math.random()}`,
              name: trimmed,
              color: `obra-${(worksites.length + newWorksites.length % 5) + 1}`,
              visible: true
            });
          }
        }
      } catch (e) {
        console.error("Erro ao processar linha:", trimmed);
      }
    });

    if (newResources.length > 0 || newWorksites.length > 0) {
      setResources(prev => [...prev, ...newResources]);
      setWorksites(prev => [...prev, ...newWorksites]);
      alert(`Importação concluída!\n${newResources.length} Recursos e ${newWorksites.length} Obras adicionados.`);
    } else {
      alert("Nenhum dado válido encontrado para importação.");
    }
  };

  const updateAllocation = (resourceId: string, siteId: string) => {
    setAllocations(prev => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        [resourceId]: siteId
      }
    }));

    // CORREÇÃO: Limpar alocações parciais antigas ao mover integralmente
    setPartialAllocations(prev => {
      const dayPartials = { ...prev[dateKey] };
      if (dayPartials[resourceId]) {
        delete dayPartials[resourceId];
        return { ...prev, [dateKey]: dayPartials };
      }
      return prev;
    });

    setSelectedResourceId(null); // Limpar seleção após alocar
  };

  const handleMonthChange = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  const handleCardClick = (resourceId: string) => {
    const currentDayLinks = resourceLinks[dateKey] || {};

    // Se já tinha algo selecionado e o novo clique é um recurso diferente
    if (selectedResourceId && selectedResourceId !== resourceId) {
      const res1 = resources.find(r => r.id === selectedResourceId);
      const res2 = resources.find(r => r.id === resourceId);

      // Se um é máquina e outro é funcionário
      if (res1 && res2 && res1.type !== res2.type) {
        const loc1 = currentAllocations[res1.id] || 'pateo';
        const loc2 = currentAllocations[res2.id] || 'pateo';

        if (loc1 === loc2) {
          const machine = res1.type === 'machine' ? res1 : res2;
          const employee = res1.type === 'employee' ? res1 : res2;

          // Se já estava vinculado a este específico, remove
          if (currentDayLinks[machine.id] === employee.id) {
            setResourceLinks(prev => {
              const newLinks = { ...prev };
              const dayLinks = { ...newLinks[dateKey] };
              delete dayLinks[machine.id];
              newLinks[dateKey] = dayLinks;
              return newLinks;
            });
          } else {
            // Caso contrário, vincula
            setResourceLinks(prev => ({
              ...prev,
              [dateKey]: {
                ...(prev[dateKey] || {}),
                [machine.id]: employee.id
              }
            }));
          }

          setSelectedResourceId(null);
          return;
        }
      }
    }

    // Toggle: se já está selecionado, desseleciona
    setSelectedResourceId(prev => prev === resourceId ? null : resourceId);
  };

  const onDragStart = (e: React.DragEvent, id: string) => {
    console.log('Drag started with ID:', id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
  };

  const onDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('dragging');
  };

  const onDrop = (e: React.DragEvent, worksiteId: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const data = e.dataTransfer.getData('text/plain');
    console.log('Dropped data:', data, 'on worksite:', worksiteId);

    // Verificar se é uma alocação parcial (formato: partial:resourceId:index)
    if (data.startsWith('partial:')) {
      const parts = data.split(':');
      if (parts.length === 3) {
        const resourceId = parts[1];
        const index = parseInt(parts[2]);

        console.log('Processing partial drop for resource:', resourceId, 'index:', index);

        setPartialAllocations(prev => {
          const currentPartials = [...(prev[dateKey]?.[resourceId] || [])];
          if (currentPartials[index]) {
            // Atualizar o worksiteId da parcial específica
            currentPartials[index] = {
              ...currentPartials[index],
              worksiteId: worksiteId
            };

            return {
              ...prev,
              [dateKey]: {
                ...(prev[dateKey] || {}),
                [resourceId]: currentPartials
              }
            };
          }
          return prev;
        });
        return;
      }
    }

    // Comportamento normal para recursos inteiros
    if (worksiteId === 'trash-zone') {
      if (confirm(`Tem certeza que deseja marcar este recurso como DEMITIDO/INATIVO a partir de HOJE (${format(currentDate, 'dd/MM/yyyy')})?\n\nEle não aparecerá mais nas próximas datas, mas o histórico passado será mantido.`)) {
        const resourceId = data;
        setResources(prev => prev.map(r => {
          if (r.id === resourceId) {
            return { ...r, dismissedAt: dateKey };
          }
          return r;
        }));
      }
      return;
    }

    updateAllocation(data, worksiteId);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleWorksiteClick = (siteId: string) => {
    if (selectedResourceId) {
      updateAllocation(selectedResourceId, siteId);
    }
  };

  const updateObservation = (siteId: string, text: string) => {
    setObservations(prev => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        [siteId]: text
      }
    }));
  };

  // -- Exportar Apenas Dados (JSON) --
  const handleExportData = () => {
    const fileNameBase = `Backup Quadro Alocação (${format(new Date(), 'dd-MM-yyyy')})`;
    const masterData = {
      resources,
      worksites,
      allocations,
      observations,
      worksiteVisibility,
      allocationMetadata,
      resourceLinks,
      maintenanceHistory,
      overtime,
      partialAllocations,
      exportDate: new Date().toISOString()
    };
    const jsonBlob = new Blob([JSON.stringify(masterData, null, 2)], { type: 'application/json' });
    saveAs(jsonBlob, `${fileNameBase}.json`);
    alert("Dados exportados com sucesso! (Arquivo JSON)");
  };

  // -- Exportar Apenas Imagem (JPEG) --
  const handleExportImage = async () => {
    const fileNameBase = `Quadro Alocação (${format(currentDate, 'dd-MM-yyyy')})`;

    if (boardRef.current) {
      // SALVAR ESTADO ORIGINAL
      const originalStyles: Map<Element, string> = new Map();
      const originalTextareas: { textarea: HTMLTextAreaElement, parent: HTMLElement, div: HTMLDivElement }[] = [];
      let headerElement: HTMLElement | null = null;

      try {
        // 1. MODIFICAR DOM ORIGINAL ANTES DA CAPTURA
        const board = boardRef.current;

        // INJETAR CABEÇALHO TEMPORÁRIO
        headerElement = document.createElement('div');
        headerElement.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 40px;
          background: #f1f5f9;
          border-bottom: 2px solid #e2e8f0;
          margin-bottom: 20px;
          font-family: 'Inter', sans-serif;
        `;

        headerElement.innerHTML = `
          <div>
            <h1 style="font-size: 28px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.5px;">COLLINE ENGENHARIA</h1>
            <p style="font-size: 14px; color: #3b82f6; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin-top: 5px;">Quadro de Alocação Digital</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 18px; font-weight: 700; color: #1e293b; margin: 0;">DATA: ${format(currentDate, "dd/MM/yyyy")}</p>
            <p style="font-size: 12px; color: #64748b; margin-top: 5px;">Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
          </div>
        `;

        // Inserir no topo do board
        board.insertBefore(headerElement, board.firstChild);

        // Limitar largura do board para evitar espaço vazio e DESATIVAR ANIMAÇÕES
        originalStyles.set(board, board.getAttribute('style') || '');
        board.style.setProperty('max-width', '1600px', 'important');
        board.style.setProperty('width', '1600px', 'important'); // Forçar largura fixa
        board.style.setProperty('animation', 'none', 'important');
        board.style.setProperty('transition', 'none', 'important');
        board.style.setProperty('opacity', '1', 'important');
        board.style.setProperty('background', '#f1f5f9', 'important');
        // Adicionar padding extra no final para evitar corte do pátio
        board.style.setProperty('padding-bottom', '100px', 'important');

        // Grid de obras
        const grid = board.querySelector('.obras-grid') as HTMLElement;
        if (grid) {
          originalStyles.set(grid, grid.getAttribute('style') || '');
          grid.style.setProperty('display', 'flex', 'important');
          grid.style.setProperty('flex-wrap', 'wrap', 'important');
          grid.style.setProperty('gap', '18px', 'important');
          grid.style.setProperty('justify-content', 'space-between', 'important');
          grid.style.setProperty('align-items', 'stretch', 'important');

          // Obras individuais
          const containers = grid.querySelectorAll('.obra-container');
          containers.forEach((c) => {
            const container = c as HTMLElement;
            originalStyles.set(container, container.getAttribute('style') || '');
            container.style.setProperty('flex', '1 1 calc(50% - 10px)', 'important');
            container.style.setProperty('min-width', '580px', 'important');
            container.style.setProperty('max-width', 'calc(50% - 10px)', 'important');
            container.style.setProperty('opacity', '1', 'important');
            container.style.setProperty('background', 'white', 'important');
            // Remover sombra para ficar mais clean na impressão
            container.style.setProperty('box-shadow', 'none', 'important');
            container.style.setProperty('border', '1px solid #cbd5e1', 'important');

            // Conteúdo da obra
            const content = container.querySelector('.obra-content') as HTMLElement;
            if (content) {
              originalStyles.set(content, content.getAttribute('style') || '');
              content.style.setProperty('display', 'flex', 'important');
              content.style.setProperty('flex-wrap', 'wrap', 'important');
              content.style.setProperty('gap', '12px', 'important');
              content.style.setProperty('justify-content', 'flex-start', 'important');
              content.style.setProperty('align-content', 'flex-start', 'important');
              content.style.setProperty('padding', '16px', 'important');
              content.style.setProperty('background', '#fafafa', 'important');
              content.style.setProperty('opacity', '1', 'important');
            }
          });
        }

        // 2. SUBSTITUIR TEXTAREAS POR DIVS
        const notes = board.querySelectorAll('.obra-notes');
        notes.forEach((note) => {
          const textarea = note.querySelector('textarea');
          if (textarea) {
            const val = textarea.value;
            const div = document.createElement('div');
            div.className = 'pdf-comment-replacement';
            div.style.setProperty('white-space', 'pre-wrap', 'important');
            div.style.setProperty('word-wrap', 'break-word', 'important');
            div.style.setProperty('padding', '10px', 'important');
            div.style.setProperty('font-size', '13px', 'important');
            div.style.setProperty('line-height', '1.5', 'important');
            div.style.setProperty('border', '1px solid #e2e8f0', 'important');
            div.style.setProperty('border-radius', '8px', 'important');
            div.style.setProperty('min-height', '50px', 'important');
            div.style.setProperty('background', 'white', 'important');
            div.style.setProperty('color', '#1e293b', 'important');
            div.style.setProperty('font-family', 'Inter, sans-serif', 'important');
            div.style.setProperty('width', '100%', 'important');
            div.textContent = val || 'Sem observações.';

            originalStyles.set(textarea, textarea.getAttribute('style') || '');
            textarea.style.setProperty('display', 'none', 'important');
            note.insertBefore(div, note.firstChild);
            originalTextareas.push({ textarea, parent: note as HTMLElement, div });
          }
        });

        // 2.5 OCULTAR ELEMENTOS QUE NÃO DEVEM SAIR NA FOTO
        const elementsToHide = board.querySelectorAll('.trash-zone');
        elementsToHide.forEach((el) => {
          const element = el as HTMLElement;
          originalStyles.set(element, element.getAttribute('style') || '');
          element.style.setProperty('display', 'none', 'important');
        });

        // 3. FORÇAR OPACIDADE NOS CARDS
        const cards = board.querySelectorAll('.resource-card');
        cards.forEach((card) => {
          const c = card as HTMLElement;
          originalStyles.set(c, c.getAttribute('style') || '');
          c.style.setProperty('opacity', '1', 'important');
          c.style.setProperty('background', 'white', 'important');
          c.style.setProperty('filter', 'none', 'important');
          c.style.setProperty('box-shadow', 'none', 'important');
          c.style.setProperty('border', '1px solid #cbd5e1', 'important');

          // Foto
          const photo = c.querySelector('.resource-card-photo') as HTMLElement;
          if (photo) {
            originalStyles.set(photo, photo.getAttribute('style') || '');
            photo.style.setProperty('opacity', '1', 'important');
            photo.style.setProperty('filter', 'none', 'important');
            photo.style.setProperty('-webkit-filter', 'none', 'important');
          }

          // Textos
          const name = c.querySelector('.resource-card-name') as HTMLElement;
          if (name) {
            originalStyles.set(name, name.getAttribute('style') || '');
            name.style.setProperty('opacity', '1', 'important');
            name.style.setProperty('color', '#0f172a', 'important');
          }

          const role = c.querySelector('.resource-card-role') as HTMLElement;
          if (role) {
            originalStyles.set(role, role.getAttribute('style') || '');
            role.style.setProperty('opacity', '1', 'important');
            role.style.setProperty('color', '#64748b', 'important');
          }
        });

        // 3.5 LIMPEZA GLOBAL VIA CLASSE CSS (muito mais rápido que iterar cada elemento)
        document.body.classList.add('capturing-screenshot');

        // 4. AGUARDAR RENDERIZAÇÃO (reduzido de 800ms para 200ms)
        await new Promise(resolve => setTimeout(resolve, 200));

        // 5. CAPTURAR E SALVAR (JPEG)
        // Pegar dimensões REAIS do elemento para não cortar nada
        const width = board.offsetWidth;
        const height = board.scrollHeight + 50; // Um pouco mais de folga

        const canvas = await html2canvas(board, {
          scale: 2, // Boa resolução mas arquivo menor que scale 3
          useCORS: true,
          logging: false,
          backgroundColor: '#f1f5f9',
          imageTimeout: 0,
          width: width,
          height: height,
          windowWidth: width,
          windowHeight: height,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0
        });

        canvas.toBlob((blob) => {
          if (blob) {
            saveAs(blob, `${fileNameBase}.jpg`);
            alert("Imagem JPEG salva com sucesso!");
          } else {
            throw new Error("Falha ao gerar Blob");
          }
        }, 'image/jpeg', 0.9); // Qualidade 90%

      } catch (err) {
        console.error("Erro:", err);
        alert("Erro ao gerar imagem");
      } finally {
        // 7. RESTAURAR ESTADO ORIGINAL

        // Remover a classe global de captura
        document.body.classList.remove('capturing-screenshot');

        // Remover header
        if (headerElement) {
          headerElement.remove();
        }

        originalStyles.forEach((style, element) => {
          if (style) {
            (element as HTMLElement).setAttribute('style', style);
          } else {
            (element as HTMLElement).removeAttribute('style');
          }
        });

        originalTextareas.forEach(({ div }) => {
          div.remove();
        });
      }
    }
  };

  const handleImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.resources && data.allocations && data.worksites) {
          if (confirm("Isso restaurará TODAS as informações (obras, funcionários, histórico e VÍNCULOS). Continuar?")) {
            setResources(data.resources);
            setWorksites(data.worksites);
            setAllocations(data.allocations);
            setObservations(data.observations || {});
            setWorksiteVisibility(data.worksiteVisibility || {});
            setAllocationMetadata(data.allocationMetadata || {});
            setResourceLinks(data.resourceLinks || {});
            setMaintenanceHistory(data.maintenanceHistory || {});
            setOvertime(data.overtime || {});
            setPartialAllocations(data.partialAllocations || {});
          }
        } else {
          alert("Arquivo inválido ou corrompido.");
        }
      } catch (err) {
        alert("Erro ao ler o arquivo de backup.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      {/* HEADER */}
      <header style={{
        background: 'white',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        padding: '16px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '900', color: '#0f172a', marginBottom: '2px', letterSpacing: '-0.5px' }}>
              COLLINE ENGENHARIA
            </h1>
            <p style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '2px' }}>
              Quadro de Alocação Digital
            </p>
          </div>

          <div style={{ display: 'flex', gap: '6px', background: '#f8fafc', padding: '6px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <button
              onClick={() => setActiveTab('board')}
              style={{
                padding: '10px 24px',
                borderRadius: '12px',
                border: 'none',
                background: activeTab === 'board' ? '#3b82f6' : 'transparent',
                color: activeTab === 'board' ? 'white' : '#64748b',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: activeTab === 'board' ? '0 4px 10px rgba(59, 130, 246, 0.3)' : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <LayoutDashboard size={18} /> Quadro
            </button>
            <button
              onClick={() => setActiveTab('fuel')}
              style={{
                padding: '10px 24px',
                borderRadius: '12px',
                border: 'none',
                background: activeTab === 'fuel' ? '#3b82f6' : 'transparent',
                color: activeTab === 'fuel' ? 'white' : '#64748b',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: activeTab === 'fuel' ? '0 4px 10px rgba(59, 130, 246, 0.3)' : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <FuelIcon size={18} /> Combustível
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              style={{
                padding: '10px 24px',
                borderRadius: '12px',
                border: 'none',
                background: activeTab === 'analytics' ? '#3b82f6' : 'transparent',
                color: activeTab === 'analytics' ? 'white' : '#64748b',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: activeTab === 'analytics' ? '0 4px 10px rgba(59, 130, 246, 0.3)' : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <PieChartIcon size={18} /> Painel Analítico
            </button>
          </div>
        </div>

        {(activeTab === 'board' || activeTab === 'fuel') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#ffffff', padding: '8px 16px', borderRadius: '16px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' }}>
            <button onClick={() => setCurrentDate(subDays(currentDate, 1))} className="btn" style={{ padding: '8px', background: '#f1f5f9', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
              <ChevronLeft size={20} />
            </button>
            <div style={{ position: 'relative', minWidth: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input
                type="date"
                value={format(currentDate, 'yyyy-MM-dd')}
                onChange={(e) => setCurrentDate(parseISO(e.target.value))}
                onClick={(e) => {
                  try {
                    (e.currentTarget as any).showPicker();
                  } catch (err) {
                    console.log("Picker not supported");
                  }
                }}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  width: '100%',
                  height: '100%',
                  cursor: 'pointer',
                  zIndex: 2
                }}
              />
              <div style={{ padding: '0 20px', fontWeight: '800', fontSize: '16px', color: '#1e293b', textAlign: 'center', pointerEvents: 'none' }}>
                <CalendarIcon size={18} style={{ display: 'inline', marginRight: '10px', color: '#3b82f6' }} />
                {format(currentDate, "dd 'de' MMMM", { locale: ptBR })}
              </div>
            </div>
            <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="btn" style={{ padding: '8px', background: '#f1f5f9', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {/* CONTROLES DO QUADRO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Status da Alocação */}
          <button
            onClick={handleToggleFinalAllocation}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '12px',
              border: '2px solid',
              borderColor: currentMetadata.isFinalAllocation ? '#10b981' : '#f59e0b',
              background: currentMetadata.isFinalAllocation ? '#ecfdf5' : '#fffbeb',
              color: currentMetadata.isFinalAllocation ? '#065f46' : '#92400e',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '700',
              transition: 'all 0.2s'
            }}
          >
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '5px',
              background: currentMetadata.isFinalAllocation ? '#10b981' : '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '11px'
            }}>
              {currentMetadata.isFinalAllocation ? '✓' : '📋'}
            </div>
            <span>{currentMetadata.isFinalAllocation ? 'Alocação Final' : 'Em Planejamento'}</span>
          </button>

          {/* Copiar/Colar */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleCopyBoard}
              className="btn"
              style={{
                background: '#f1f5f9',
                color: '#475569',
                border: 'none',
                fontSize: '13px',
                padding: '8px 14px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              📋 Copiar
            </button>
            <button
              onClick={handlePasteBoard}
              disabled={!clipboard}
              style={{
                background: clipboard ? '#3b82f6' : '#f1f5f9',
                color: clipboard ? 'white' : '#94a3b8',
                border: 'none',
                fontSize: '13px',
                padding: '8px 14px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: '700',
                cursor: clipboard ? 'pointer' : 'not-allowed',
                opacity: clipboard ? 1 : 0.6
              }}
            >
              📥 Colar
            </button>
          </div>

          {/* Export/Import/Image */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleExportData}
              className="btn btn-primary"
              style={{ fontSize: '13px', padding: '8px 14px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Baixar Backup de Dados (JSON)"
            >
              <FileJson size={16} /> Backup
            </button>
            <button
              onClick={handleExportImage}
              className="btn"
              style={{
                fontSize: '13px',
                padding: '8px 14px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              title="Baixar Foto do Quadro (PDF)"
            >
              <Camera size={16} /> Imagem
            </button>
            <label className="btn btn-success" style={{ fontSize: '13px', padding: '8px 14px', borderRadius: '12px', cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Upload size={16} /> Importar
              <input
                type="file"
                className="hidden"
                accept=".json"
                onChange={(e) => e.target.files?.[0] && handleImportBackup(e.target.files[0])}
              />
            </label>
            {/* Botão de Logout */}
            <button
              onClick={async () => {
                if (confirm('Deseja sair do sistema?')) await signOut();
              }}
              className="btn"
              style={{
                fontSize: '13px',
                padding: '8px 14px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              title={`Sair (${user?.email})`}
            >
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO */}
      {activeTab === 'board' ? (
        <main ref={boardRef} style={{ padding: '32px', maxWidth: '1600px', margin: '0 auto' }} className="animate-fade-in">
          {/* OBRAS ATIVAS */}
          <div className="obras-grid">
            {worksites
              .filter(ws => isWorksiteVisible(ws.id))
              .map((site) => (
                <div
                  key={site.id}
                  className={`obra-container ${site.color} drop-zone`}
                  onDrop={(e) => onDrop(e, site.id)}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onClick={() => handleWorksiteClick(site.id)}
                  style={{ cursor: selectedResourceId ? 'pointer' : 'default' }}
                >
                  <div className="obra-header">
                    <span>{site.name}</span>
                    <span style={{ fontSize: '11px', opacity: 0.9 }}>
                      {getResourcesForSite(site.id).length} alocados
                    </span>
                  </div>
                  <div className="obra-content">
                    {getResourcesForSite(site.id).map(item => (
                      <ResourceCard
                        key={item.key}
                        resource={item.resource}
                        allocatedHours={item.allocatedHours}
                        dragId={item.dragId} // Passando ID especial
                        onHourSplit={handleHourSplit}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onClick={() => handleCardClick(item.resource.id)}
                        isSelected={selectedResourceId === item.resource.id}
                        onToggleMaintenance={handleToggleMaintenance}
                        onOvertime={(id) => { setOvertimeResourceId(id); setShowOvertimeModal(true); }}
                        hasOvertime={!!overtime[dateKey]?.[item.resource.id]}
                        linkedResource={item.resource.type === 'machine' ? resources.find(r => r.id === (resourceLinks[dateKey]?.[item.resource.id])) : undefined}
                        inMaintenance={item.inMaintenance !== undefined ? item.inMaintenance : isResourceInMaintenance(item.resource.id, dateKey)}
                      />
                    ))}
                  </div>
                  <div className="obra-notes">
                    <textarea
                      placeholder="📝 Observações da obra..."
                      rows={2}
                      value={currentObservations[site.id] || ''}
                      onChange={(e) => updateObservation(site.id, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            {worksites.filter(ws => isWorksiteVisible(ws.id)).length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', background: 'white', borderRadius: '20px', border: '2px dashed #cbd5e1', color: '#64748b' }}>
                Nenhuma obra visível no quadro hoje. Acesse as configurações para ativar obras.
              </div>
            )}
          </div>

          {/* PÁTIO */}
          <div className="pateo-container drop-zone"
            onDrop={(e) => onDrop(e, 'pateo')}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => handleWorksiteClick('pateo')}
            style={{ marginTop: '40px', cursor: selectedResourceId ? 'pointer' : 'default' }}
          >
            <div className="pateo-header">
              <span>🅿️ PÁTIO DE RECURSOS (DISPONÍVEIS)</span>
              <span style={{ fontSize: '13px', fontWeight: '700', opacity: 0.95, padding: '4px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: '20px' }}>
                {getResourcesForSite('pateo').length}
              </span>
            </div>
            <div className="pateo-content">
              {getResourcesForSite('pateo').map(item => (
                <ResourceCard
                  key={item.key}
                  resource={item.resource}
                  allocatedHours={item.allocatedHours}
                  dragId={item.dragId} // Passando ID especial
                  onHourSplit={handleHourSplit}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onClick={() => handleCardClick(item.resource.id)}
                  isSelected={selectedResourceId === item.resource.id}
                  onToggleMaintenance={handleToggleMaintenance}
                  onOvertime={(id) => { setOvertimeResourceId(id); setShowOvertimeModal(true); }}
                  hasOvertime={!!overtime[dateKey]?.[item.resource.id]}
                  linkedResource={item.resource.type === 'machine' ? resources.find(r => r.id === (resourceLinks[dateKey]?.[item.resource.id])) : undefined}
                  inMaintenance={item.inMaintenance !== undefined ? item.inMaintenance : isResourceInMaintenance(item.resource.id, dateKey)}
                />
              ))}
            </div>
          </div>
          {/* ÁREA DE DEMISSÃO (LIXEIRA) */}
          <div
            className="trash-zone drop-zone"
            onDrop={(e) => onDrop(e, 'trash-zone')}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            style={{
              marginTop: '40px',
              border: '2px dashed #ef4444',
              borderRadius: '12px',
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              color: '#ef4444',
              backgroundColor: '#fef2f2',
              opacity: 0.8,
              transition: 'all 0.2s'
            }}
          >
            <Trash2 size={24} />
            <span style={{ fontWeight: '700', fontSize: '14px' }}>
              ARRASTE AQUI PARA DEMITIR / INATIVAR (Mantém histórico passado)
            </span>
          </div>
        </main >
      ) : activeTab === 'fuel' ? (
        <FuelManager
          resources={resources}
          fuelData={fuelData}
          onUpdateFuel={handleUpdateFuel}
          currentDate={currentDate}
          allocations={allocations}
          maintenanceHistory={maintenanceHistory}

          worksites={worksites}
          fuelQuotes={fuelQuotes}
          onUpdateFuelQuote={(date, val) => setFuelQuotes(prev => ({ ...prev, [date]: val }))}
        />
      ) : (
        <AnalyticalDashboard
          resources={resources}
          allocations={allocations}
          overtime={overtime}
          maintenanceHistory={maintenanceHistory}
          partialAllocations={partialAllocations}
          fuelData={fuelData}
          worksites={worksites}
          selectedMonth={currentDate}
          onMonthChange={handleMonthChange}
          fuelQuotes={fuelQuotes}
          allocationMetadata={allocationMetadata}
        />
      )
      }

      {/* MENU DE GESTÃO CONSOLIDADO */}
      <div style={{ position: 'fixed', bottom: '32px', left: '32px', zIndex: 100 }}>
        {isMenuOpen && (
          <div className="menu-gestao animate-fade-in" style={{
            background: 'white',
            borderRadius: '20px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            marginBottom: '16px',
            padding: '12px',
            width: '240px',
            border: '1px solid #e2e8f0'
          }}>
            <button
              onClick={() => { setShowResourceSettings(true); setIsMenuOpen(false); }}
              className="menu-item"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                color: '#1e293b',
                fontWeight: '700',
                fontSize: '14px',
                transition: 'background 0.2s'
              }}
            >
              <div style={{ background: '#dbeafe', color: '#1d4ed8', padding: '8px', borderRadius: '10px', display: 'flex' }}><Users size={18} /></div>
              Gerenciar Recursos
            </button>
            <button
              onClick={() => { setShowWorksiteSettings(true); setIsMenuOpen(false); }}
              className="menu-item"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                color: '#1e293b',
                fontWeight: '700',
                fontSize: '14px',
                transition: 'background 0.2s',
                marginTop: '4px'
              }}
            >
              <div style={{ background: '#fef3c7', color: '#b45309', padding: '8px', borderRadius: '10px', display: 'flex' }}><Building2 size={18} /></div>
              Gerenciar Obras
            </button>
          </div>
        )}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`fixed-btn-gestao ${isMenuOpen ? 'active' : ''}`}
          style={{
            background: '#0f172a',
            color: 'white',
            width: '64px',
            height: '64px',
            borderRadius: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.3)',
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
        >
          {isMenuOpen ? <X size={28} /> : <Settings size={28} />}
        </button>
      </div>

      {/* COMPONENTES DE CONFIGURAÇÃO */}
      {
        showWorksiteSettings && (
          <WorksiteSettings
            worksites={worksites}
            onAdd={handleAddWorksite}
            onDelete={handleDeleteWorksite}
            onRename={handleRenameWorksite}
            onToggleVisibility={handleToggleWorksiteVisibility}
            onToggleAllVisibility={handleToggleAllWorksites}
            currentDate={currentDate}
            worksiteVisibility={worksiteVisibility[dateKey] || {}}
            allocationsForDate={currentAllocations}
            resources={resources}
            onClose={() => setShowWorksiteSettings(false)}
          />
        )
      }

      {
        showResourceSettings && (
          <ResourceSettings
            resources={resources}
            onAdd={handleAddResource}
            onUpdate={handleUpdateResource}
            onDelete={handleDeleteResource}
            onBulkImport={handleBulkImport}
            onClose={() => setShowResourceSettings(false)}
          />
        )
      }

      {
        showOvertimeModal && overtimeResourceId && (
          <OvertimeModal
            resource={resources.find(r => r.id === overtimeResourceId)!}
            currentOvertime={overtime[dateKey]?.[overtimeResourceId]}
            onSave={(entry) => {
              setOvertime(prev => ({
                ...prev,
                [dateKey]: {
                  ...(prev[dateKey] || {}),
                  [overtimeResourceId]: entry
                }
              }));
              setShowOvertimeModal(false);
            }}
            onDelete={() => {
              setOvertime(prev => {
                const newOvertime = { ...prev };
                if (newOvertime[dateKey]) {
                  delete newOvertime[dateKey][overtimeResourceId];
                }
                return newOvertime;
              });
              setShowOvertimeModal(false);
            }}
            onClose={() => setShowOvertimeModal(false)}
          />
        )
      }

      {
        showHourSplitModal && hourSplitResourceId && (
          <HourSplitModal
            resource={resources.find(r => r.id === hourSplitResourceId)!}
            currentDate={currentDate}
            currentHours={partialAllocations[dateKey]?.[hourSplitResourceId]?.[0]?.hours}
            onSave={handleSaveHourSplit}
            onDelete={handleDeleteHourSplit}
            onClose={() => setShowHourSplitModal(false)}
          />
        )
      }
    </div >
  );
}



export default App;
