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
import * as XLSX from 'xlsx';
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
  const hasActions = (!inMaintenance && onHourSplit) || 
                     (resource.type === 'employee' && onOvertime) || 
                     (resource.type === 'machine' && onToggleMaintenance);

  return (
    <div
      draggable={isDraggable}
      onDragStart={(e) => isDraggable && onDragStart(e, dragId || resource.id)}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        e.stopPropagation();
        if (!inMaintenance) onClick?.();
      }}
      className={`resource-card animate-scale-in ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''} ${inMaintenance ? 'in-maintenance' : ''}`}
      style={{
        cursor: isDraggable ? 'grab' : 'not-allowed',
        position: 'relative',
        opacity: inMaintenance && !dragId ? 0.7 : 1, // Menor opacidade apenas se bloqueado de verdade
        minHeight: '85px'
      }}
    >
      {inMaintenance && (
        <div style={{
          position: 'absolute',
          top: '4px',
          right: '4px',
          background: '#fb923c',
          color: 'white',
          fontSize: '7px',
          padding: '2px 4px',
          borderRadius: '4px',
          fontWeight: '800',
          zIndex: 10
        }}>
          MANUT.
        </div>
      )}
      {resource.isAdministrative && (
        <div style={{
          position: 'absolute',
          top: '4px',
          left: '4px',
          background: '#64748b',
          color: 'white',
          fontSize: '7px',
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
        className={`resource-card-photo ${resource.type}`}
      />
      <div className="resource-card-name">{resource.name}</div>
      <div className="resource-card-role">{resource.role}</div>

      {resource.type === 'machine' && linkedResource && (
        <div style={{
          marginTop: '4px',
          paddingTop: '4px',
          borderTop: '1px solid #e2e8f0',
          fontSize: '8px',
          fontWeight: '700',
          color: '#3b82f6',
          display: 'flex',
          alignItems: 'center',
          gap: '2px'
        }}>
          👤 {linkedResource.name}
        </div>
      )}

      {hasActions && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '4px',
          width: '100%',
          marginTop: 'auto',
          paddingTop: '4px',
          borderTop: '1px solid #f1f5f9'
        }}>
          {/* Divisão de horas */}
          {!inMaintenance && onHourSplit && (
            allocatedHours ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onHourSplit(resource.id);
                }}
                style={{
                  background: 'rgba(139, 92, 246, 0.1)',
                  color: '#8b5cf6',
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                  borderRadius: '4px',
                  width: '24px',
                  height: '18px',
                  cursor: 'pointer',
                  fontSize: '8px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                title="Editar Carga Horária"
              >
                {allocatedHours}h
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onHourSplit(resource.id);
                }}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '4px',
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  color: '#8b5cf6'
                }}
                title="Dividir Carga Horária"
              >
                ⏱️
              </button>
            )
          )}

          {/* Horas extras (Funcionário apenas) */}
          {resource.type === 'employee' && onOvertime && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOvertime(resource.id);
              }}
              style={{
                background: hasOvertime ? '#eff6ff' : '#f1f5f9',
                color: hasOvertime ? '#2563eb' : '#64748b',
                border: hasOvertime ? '1px solid #bfdbfe' : 'none',
                borderRadius: '4px',
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              title="Lançar Horas Extras"
            >
              💲
            </button>
          )}

          {/* Manutenção (Máquina apenas) */}
          {resource.type === 'machine' && onToggleMaintenance && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMaintenance(resource.id);
              }}
              style={{
                background: inMaintenance ? '#fffaf5' : '#f1f5f9',
                border: inMaintenance ? '1px solid #ffedd5' : 'none',
                borderRadius: '4px',
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                color: inMaintenance ? '#ea580c' : '#64748b'
              }}
              title={inMaintenance ? "Retornar ao Serviço" : "Marcar em Manutenção"}
            >
              🔧
            </button>
          )}
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Helper para limpar e corrigir obras duplicadas e máquinas demitidas incorretamente
  const sanitizeAppState = (state: any) => {
    if (!state) return state;

    // 1. Ressuscitar máquinas demitidas por engano
    if (Array.isArray(state.resources)) {
      state.resources = state.resources.map((r: any) => {
        if (r.type === 'machine' && r.dismissedAt) {
          console.log(`[Sanitização] Máquina "${r.name}" reativada.`);
          return { ...r, dismissedAt: undefined };
        }
        return r;
      });
    }

    // 2. Encontrar obras duplicadas com nomes do tipo PÁTIO
    let worksitesList = Array.isArray(state.worksites) ? [...state.worksites] : [];
    const duplicatePatioSites = worksitesList.filter(w => {
      const cleanName = w.name.trim().toUpperCase();
      return w.id !== 'pateo' && (cleanName === 'PÁTIO' || cleanName === 'PATIO' || cleanName === 'PÁTEO' || cleanName === 'PATEO');
    });

    if (duplicatePatioSites.length > 0) {
      const duplicateIds = duplicatePatioSites.map(w => w.id);
      console.log('[Sanitização] Obras duplicadas do Pátio encontradas e removidas:', duplicatePatioSites.map(w => w.name));

      // Remove dos worksites
      state.worksites = worksitesList.filter(w => !duplicateIds.includes(w.id));

      // Limpar das allocations simples
      if (state.allocations && typeof state.allocations === 'object') {
        const newAllocations = { ...state.allocations };
        Object.keys(newAllocations).forEach(date => {
          const dayAlloc = { ...newAllocations[date] };
          let modified = false;
          Object.keys(dayAlloc).forEach(resId => {
            if (duplicateIds.includes(dayAlloc[resId])) {
              dayAlloc[resId] = 'pateo';
              modified = true;
            }
          });
          if (modified) {
            newAllocations[date] = dayAlloc;
          }
        });
        state.allocations = newAllocations;
      }

      // Limpar das alocações parciais
      if (state.partialAllocations && typeof state.partialAllocations === 'object') {
        const newPartials = { ...state.partialAllocations };
        Object.keys(newPartials).forEach(date => {
          const dayPartialsObj = { ...newPartials[date] };
          let dateModified = false;
          Object.keys(dayPartialsObj).forEach(resId => {
            const resPartials = Array.isArray(dayPartialsObj[resId]) ? [...dayPartialsObj[resId]] : [];
            let resModified = false;
            const cleanedResPartials = resPartials.map(p => {
              if (duplicateIds.includes(p.worksiteId)) {
                resModified = true;
                return { ...p, worksiteId: 'pateo' };
              }
              return p;
            });
            if (resModified) {
              dayPartialsObj[resId] = cleanedResPartials;
              dateModified = true;
            }
          });
          if (dateModified) {
            newPartials[date] = dayPartialsObj;
          }
        });
        state.partialAllocations = newPartials;
      }
    }

    return state;
  };

  // === CARREGAR DADOS DO SUPABASE ===
  useEffect(() => {
    if (!user) return;

    const loadFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('app_state')
          .select('state')
          .eq('user_id', '00000000-0000-0000-0000-000000000000') // ID ÚNICO GLOBAL DO QUADRO
          .single();

        if (error) {
          console.error('Erro ao carregar do Supabase:', error);
          if (error.code !== 'PGRST116') {
            throw error;
          }
        }

        if (data?.state) {
          const s = sanitizeAppState(data.state);
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
          
          setDataLoaded(true);
          setLoadError(null);
        } else {
          // Usuário novo ou sem dados no banco: carregar dados do localStorage como migração
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

            const tempState: any = {
              resources: savedResources ? JSON.parse(savedResources) : null,
              worksites: savedWorksites ? JSON.parse(savedWorksites) : null,
              allocations: savedAllocations ? JSON.parse(savedAllocations) : null,
              observations: savedObservations ? JSON.parse(savedObservations) : null,
              worksiteVisibility: savedWorksiteVisibility ? JSON.parse(savedWorksiteVisibility) : null,
              allocationMetadata: savedMetadata ? JSON.parse(savedMetadata) : null,
              overtime: savedOvertime ? JSON.parse(savedOvertime) : null,
              resourceLinks: savedLinks ? JSON.parse(savedLinks) : null,
              maintenanceHistory: savedMaintenance ? JSON.parse(savedMaintenance) : null,
              partialAllocations: savedPartialAllocations ? JSON.parse(savedPartialAllocations) : null,
              fuelData: savedFuel ? JSON.parse(savedFuel) : null,
              fuelQuotes: savedFuelQuotes ? JSON.parse(savedFuelQuotes) : null,
            };

            const s = sanitizeAppState(tempState);

            if (s.resources && Array.isArray(s.resources)) setResources(s.resources);
            if (s.worksites && Array.isArray(s.worksites) && s.worksites.length > 0) setWorksites(s.worksites);
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
          } catch (localErr) {
            console.error('Erro ao carregar do localStorage:', localErr);
          }
          
          setDataLoaded(true);
          setLoadError(null);
        }
      } catch (err) {
        console.error('Erro geral ao carregar dados:', err);
        setLoadError('Erro ao carregar os dados do servidor. Por segurança, o salvamento automático está desativado para evitar sobrescrever seu quadro de alocações. Verifique sua conexão com a internet.');
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
          filter: 'user_id=eq.00000000-0000-0000-0000-000000000000' // Foca apenas na linha mestre
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
        .upsert({ user_id: '00000000-0000-0000-0000-000000000000', state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }); // Salva sempre na mesma linha mestre

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

  const handleMergeWorksites = (sourceIds: string[], targetId: string) => {
    if (!targetId || !sourceIds || sourceIds.length === 0) return;

    // 1. Atualizar a lista de obras (remover as de origem)
    setWorksites(prev => prev.filter(w => !sourceIds.includes(w.id)));

    // 2. Atualizar as alocações principais em allocations
    setAllocations(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(date => {
        const dayAllocs = { ...updated[date] };
        let changed = false;
        Object.keys(dayAllocs).forEach(resId => {
          if (sourceIds.includes(dayAllocs[resId])) {
            dayAllocs[resId] = targetId;
            changed = true;
          }
        });
        if (changed) {
          updated[date] = dayAllocs;
        }
      });
      return updated;
    });

    // 3. Atualizar alocações parciais em partialAllocations
    setPartialAllocations(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(date => {
        const dayPartials = { ...updated[date] };
        let changed = false;
        Object.keys(dayPartials).forEach(resId => {
          if (dayPartials[resId]) {
            const list = dayPartials[resId].map(p => {
              if (sourceIds.includes(p.worksiteId)) {
                return { ...p, worksiteId: targetId };
              }
              return p;
            });
            dayPartials[resId] = list;
            changed = true;
          }
        });
        if (changed) {
          updated[date] = dayPartials;
        }
      });
      return updated;
    });

    // 4. Concatenar observações em observations
    setObservations(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(date => {
        const dayObs = { ...updated[date] };
        let targetObs = dayObs[targetId] || '';
        const obsToConcat: string[] = [];
        sourceIds.forEach(srcId => {
          if (dayObs[srcId]) {
            obsToConcat.push(dayObs[srcId]);
            delete dayObs[srcId];
          }
        });
        if (obsToConcat.length > 0) {
          if (targetObs) {
            targetObs += '\n' + obsToConcat.join('\n');
          } else {
            targetObs = obsToConcat.join('\n');
          }
          dayObs[targetId] = targetObs;
          updated[date] = dayObs;
        }
      });
      return updated;
    });
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

    // NOVIDADE: Mover a alocação base para o PÁTEO para liberar a obra anterior
    setAllocations(prev => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        [hourSplitResourceId]: 'pateo'
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

        // --- LÓGICA DE RESGATE DE CARDS ÓRFÃOS ---
        // Se a obra onde o recurso está alocado não existe mais na lista oficial de worksites
        // (e ele não está no pátio), tratamos ele como órfão.
        const siteExists = worksites.some(ws => ws.id === allocatedSite);
        const isOrphan = allocatedSite !== 'pateo' && !siteExists;

        // Se siteId é pateo, e (não tem alocação ou a obra sumiu), então ele aparece aqui
        if (siteId === 'pateo' && (allocatedSite === 'pateo' || isOrphan)) {
          return [{
            resource: res,
            allocatedHours: undefined,
            key: res.id
          }];
        }

        // Se siteId é uma obra-X, e allocatedSite é obra-X, deve aparecer apenas se a obra existir
        if (allocatedSite === siteId && siteExists) {
          return [{
            resource: res,
            allocatedHours: undefined,
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
          const numContainers = containers.length;
          containers.forEach((c) => {
            const container = c as HTMLElement;
            originalStyles.set(container, container.getAttribute('style') || '');
            if (numContainers === 1) {
              container.style.setProperty('flex', '1 1 100%', 'important');
              container.style.setProperty('max-width', '100%', 'important');
            } else {
              container.style.setProperty('flex', '1 1 calc(50% - 10px)', 'important');
              container.style.setProperty('max-width', 'calc(50% - 10px)', 'important');
            }
            container.style.setProperty('min-width', '580px', 'important');
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
            
            // Permite o salvamento automático imediato das informações restauradas no banco de dados
            setDataLoaded(true);
            setLoadError(null);
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

  const handleImportExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Converte a planilha para uma matriz de linhas (vetor de vetores)
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        
        if (rows.length < 2) {
          alert("A planilha está vazia ou não possui dados suficientes.");
          return;
        }
        
        // Varredura para encontrar a linha de cabeçalho (pode estar na linha 1 ou 2)
        let headerRowIdx = -1;
        let headers: string[] = [];
        for (let rIdx = 0; rIdx < Math.min(rows.length, 15); rIdx++) {
          const row = rows[rIdx];
          if (row && row.length > 0) {
            const potentialHeaders = row.map(h => h !== undefined && h !== null ? String(h).trim().toUpperCase() : '');
            // Verifica se a linha contém as colunas obrigatórias principais
            if (
              potentialHeaders.some(h => h === 'DATA') &&
              potentialHeaders.some(h => h === 'NOME' || h === 'FUNCIONÁRIO' || h === 'FUNCIONARIO' || h === 'OPERADOR') &&
              potentialHeaders.some(h => h === 'OBRA' || h === 'LOCAL' || h === 'DESTINO')
            ) {
              headerRowIdx = rIdx;
              headers = potentialHeaders;
              break;
            }
          }
        }
        
        if (headerRowIdx === -1) {
          alert("Colunas obrigatórias 'DATA', 'NOME' e 'OBRA' não foram encontradas nas primeiras 15 linhas da planilha.");
          return;
        }
        
        // Identificar os índices das colunas de forma flexível (suporta variações)
        const colDataIdx = headers.indexOf('DATA');
        
        const colHorasIdx1 = headers.indexOf('HORAS TRABALHADAS');
        const colHorasIdx2 = headers.indexOf('HORAS TRABALHADA');
        const colHorasIdx3 = headers.indexOf('HORAS');
        const colHorasIdx4 = headers.indexOf('HORAS TRAB');
        const colHoras = colHorasIdx1 !== -1 ? colHorasIdx1 : (colHorasIdx2 !== -1 ? colHorasIdx2 : (colHorasIdx3 !== -1 ? colHorasIdx3 : colHorasIdx4));
        
        const colNomeIdx1 = headers.indexOf('NOME');
        const colNomeIdx2 = headers.indexOf('FUNCIONÁRIO');
        const colNomeIdx3 = headers.indexOf('FUNCIONARIO');
        const colNomeIdx4 = headers.indexOf('OPERADOR');
        const colNomeIdx = colNomeIdx1 !== -1 ? colNomeIdx1 : (colNomeIdx2 !== -1 ? colNomeIdx2 : (colNomeIdx3 !== -1 ? colNomeIdx3 : colNomeIdx4));
        
        const colFuncaoIdx1 = headers.indexOf('FUNÇÃO');
        const colFuncaoIdx2 = headers.indexOf('FUNCAO');
        const colFuncaoIdx3 = headers.indexOf('CARGO');
        const colFuncao = colFuncaoIdx1 !== -1 ? colFuncaoIdx1 : (colFuncaoIdx2 !== -1 ? colFuncaoIdx2 : colFuncaoIdx3);
        
        const colEquipamentoIdx1 = headers.indexOf('EQUIPAMENTO');
        const colEquipamentoIdx2 = headers.indexOf('MÁQUINA');
        const colEquipamentoIdx3 = headers.indexOf('MAQUINA');
        const colEquipamentoIdx = colEquipamentoIdx1 !== -1 ? colEquipamentoIdx1 : (colEquipamentoIdx2 !== -1 ? colEquipamentoIdx2 : colEquipamentoIdx3);
        
        const colObraIdx1 = headers.indexOf('OBRA');
        const colObraIdx2 = headers.indexOf('LOCAL');
        const colObraIdx3 = headers.indexOf('DESTINO');
        const colObraIdx = colObraIdx1 !== -1 ? colObraIdx1 : (colObraIdx2 !== -1 ? colObraIdx2 : colObraIdx3);
        
        const colObservacaoIdx1 = headers.indexOf('OBSERVAÇÃO');
        const colObservacaoIdx2 = headers.indexOf('OBSERVACAO');
        const colObservacaoIdx3 = headers.indexOf('OBS');
        const colObservacao = colObservacaoIdx1 !== -1 ? colObservacaoIdx1 : (colObservacaoIdx2 !== -1 ? colObservacaoIdx2 : colObservacaoIdx3);
        
        // Mapear coluna de custos
        const colCustoIdx1 = headers.indexOf('CUSTO');
        const colCustoIdx2 = headers.indexOf('CUSTO DIA');
        const colCustoIdx3 = headers.indexOf('VALOR DIA');
        const colCustoIdx4 = headers.indexOf('VALOR');
        const colCustoIdx = colCustoIdx1 !== -1 ? colCustoIdx1 : (colCustoIdx2 !== -1 ? colCustoIdx2 : (colCustoIdx3 !== -1 ? colCustoIdx3 : colCustoIdx4));

        if (colDataIdx === -1 || colNomeIdx === -1 || colObraIdx === -1) {
          alert("Colunas obrigatórias 'DATA', 'NOME' e 'OBRA' não foram encontradas na planilha.");
          return;
        }
        
        // Cópias do estado para manipulação segura
        const updatedResources = [...resources];
        const updatedWorksites = [...worksites];
        const updatedAllocations = { ...allocations };
        const updatedObservations = { ...observations };
        const updatedResourceLinks = { ...resourceLinks };
        const updatedPartialAllocations = { ...partialAllocations };
        
        // Tabela de Diárias Fixas de Equipamentos (Máquinas)
        const MACHINE_COSTS: { [name: string]: number } = {
          'PC200 001': 2800,
          'PC200 OO2E': 2800,
          'ESCAVADEIRA': 2800,
          'TRATOR': 900,
          'RETRO CAT': 1500,
          'CAMINHÃO BASCULANTE': 1200,
          'CAMINHÃO PIPA': 400,
          'PIPA': 400,
          'FORD F. 4000': 400,
          'ACABADORA': 2800,
          'ESPARGIDOR': 1800,
          'PATROL': 2800,
          'ROLO PÉ DE CARNEIRO': 1600
        };

        // Tabela de Diárias Fixas de Funcionários
        const OFFICIAL_EMPLOYEE_COSTS: { [name: string]: number } = {
          'AGNALDO NUNES': 416.10,
          'ANTONIO PEREIRA MELO': 395.61,
          'ASSIS FRANCISCO DA SILVA': 390.61,
          'EDMILSON NELSON DA SILVA': 480.50,
          'LEONARDO GONÇALVES': 470.00,
          'EVERALDO NUNES DA CONCEIÇÃO': 337.83,
          'JOÃO BATISTA DE CARVALHO': 355.02,
          'JOÃO PIRES': 331.25,
          'JOÃO MANOEL DA SILVA': 314.16,
          'JOSE ANTONIO FERREIRA FILHO': 407.99,
          'MIGUEL PEREIRA TEIXEIRA': 398.40,
          'RAIMUNDO NONATO MARINHO DE LIMA': 265.00,
          'VANDERLEI DOS REIS HENRIQUE': 339.55,
          'ANTONIO CARLOS COLOMBO': 287.78,
          'VAGNER DE SOUSA VIEIRA': 146.76,
          'ROMIZIO FRANCISCO DOS SANTOS': 314.16,
          'GENILDO JOVENTINO DOS SANTOS': 272.91,
          'FRANCISCO PAULINO DE OLIVEIRA': 272.91
        };

        // Helper para tratar custos em formato de moeda ou numérico de forma segura
        const parseExcelCost = (val: any): number => {
          if (val === undefined || val === null) return 0;
          if (typeof val === 'number') {
            return val;
          }
          try {
            let s = String(val).replace('R$', '').trim();
            if (s.includes('.') && s.includes(',')) {
              s = s.replace(/\./g, '').replace(',', '.');
            } else if (s.includes(',')) {
              s = s.replace(',', '.');
            }
            const num = parseFloat(s);
            return isNaN(num) ? 0 : num;
          } catch (e) {
            return 0;
          }
        };

        // Helper para normalizar nome de funcionários
        const cleanEmployeeName = (name: string): string => {
          let n = name.trim().toUpperCase().replace(/\s+/g, ' ');
          if (n === 'FRANCISCO') {
            return 'FRANCISCO PAULINO DE OLIVEIRA';
          }
          if (n === 'WAGNER DE SOUSA VIEIRA') {
            return 'VAGNER DE SOUSA VIEIRA';
          }
          if (n === 'ZENILDO JOVENTINO DOS SANTOS') {
            return 'GENILDO JOVENTINO DOS SANTOS';
          }
          return n;
        };

        // Helper para normalizar nome de máquinas
        const cleanMachineName = (name: string): string => {
          let n = name.trim().toUpperCase().replace(/\s+/g, ' ');
          if (n === 'ESCAVADEIRA ANTIGA') {
            return 'PC200 001';
          }
          if (n === 'ESCAVADEIRA NOVA' || n === 'PC200 002E' || n === 'PC200 002 E' || n === 'PC200 OO2 E') {
            return 'PC200 OO2E';
          }
          if (n === 'ASPARGIDOR') {
            return 'ESPARGIDOR';
          }
          return n;
        };

        // Helper para buscar ou criar funcionário
        const findOrCreateEmployee = (name: string, role: string, rowCost: number) => {
          const mappedName = cleanEmployeeName(name);
          let emp = updatedResources.find(r => r.type === 'employee' && cleanEmployeeName(r.name) === mappedName);
          
          const officialCost = OFFICIAL_EMPLOYEE_COSTS[mappedName];
          let finalCost = officialCost !== undefined ? officialCost : rowCost;

          if (!emp) {
            emp = {
              id: 'res-' + Date.now() + '-' + Math.random().toString().slice(2, 10),
              name: mappedName,
              type: 'employee',
              role: role ? role.trim() : 'Operador',
              photo: `https://via.placeholder.com/150?text=${mappedName.charAt(0)}`,
              costPerDay: finalCost
            };
            updatedResources.push(emp);
          } else {
            emp.name = mappedName;
            if (role) emp.role = role.trim();
            if (officialCost !== undefined) {
              emp.costPerDay = officialCost;
            } else if (finalCost > 0) {
              emp.costPerDay = finalCost;
            }
          }
          return emp;
        };
        
        // Helper para buscar ou criar equipamento (máquina)
        const findOrCreateMachine = (name: string) => {
          const mappedName = cleanMachineName(name);
          let machine = updatedResources.find(r => r.type === 'machine' && cleanMachineName(r.name) === mappedName);
          
          // Custos de máquina vêm da tabela fixa de custos de máquina
          const finalCost = MACHINE_COSTS[mappedName] || 0;

          if (!machine) {
            machine = {
              id: 'res-' + Date.now() + '-' + Math.random().toString().slice(2, 10),
              name: mappedName,
              type: 'machine',
              role: 'Equipamento',
              photo: `https://via.placeholder.com/150?text=🚜`,
              costPerDay: finalCost
            };
            updatedResources.push(machine);
          } else {
            machine.name = mappedName;
            if (finalCost > 0) {
              machine.costPerDay = finalCost;
            }
          }
          return machine;
        };
        
        // Helper para buscar ou criar obra
        const findOrCreateWorksite = (name: string) => {
          const cleanName = name.trim().toUpperCase();
          if (cleanName === 'PÁTEO' || cleanName === 'PATEO' || cleanName === 'PATIO' || cleanName === 'PÁTIO') {
            return { id: 'pateo', name: 'PÁTEO' };
          }
          if (cleanName === 'CHUVA') {
            let site = updatedWorksites.find(w => w.name.toUpperCase().trim() === 'CHUVA' || w.id === 'chuva');
            if (!site) {
              site = {
                id: 'chuva',
                name: 'CHUVA',
                color: 'obra-1',
                visible: true
              };
              updatedWorksites.push(site);
            }
            return site;
          }
          
          let site = updatedWorksites.find(w => w.name.toUpperCase().trim() === cleanName);
          if (!site) {
            const newId = 'obra-' + Date.now() + '-' + Math.random().toString().slice(2, 10);
            const colors = ['obra-1', 'obra-2', 'obra-3', 'obra-4', 'obra-5'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            site = {
              id: newId,
              name: name.trim().toUpperCase(),
              color: randomColor,
              visible: true
            };
            updatedWorksites.push(site);
          }
          return site;
        };
        
        // Processar todas as linhas primeiro
        const parsedRows: Array<{
          dateKey: string;
          employeeName: string;
          role: string;
          machineName: string;
          worksiteName: string;
          hours: number;
          observation: string;
          rowCost: number;
        }> = [];
        
        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || r.length === 0) continue;
          
          const rawDataVal = r[colDataIdx];
          if (!rawDataVal) continue;
          
          let dateKey = '';
          
          // Tratar formatos de data
          if (typeof rawDataVal === 'number') {
            // Data serial do Excel
            const date = new Date(Math.round((rawDataVal - 25569) * 86400 * 1000));
            const tzOffset = date.getTimezoneOffset() * 60000;
            const localDate = new Date(date.getTime() + tzOffset);
            dateKey = format(localDate, 'yyyy-MM-dd');
          } else {
            // String (DD/MM/YYYY ou YYYY-MM-DD)
            const dateStr = String(rawDataVal).trim();
            if (dateStr.includes('/')) {
              const parts = dateStr.split('/');
              if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2];
                dateKey = `${year}-${month}-${day}`;
              }
            } else if (dateStr.includes('-')) {
              const parts = dateStr.split('-');
              if (parts.length === 3) {
                if (parts[0].length === 4) {
                  dateKey = dateStr;
                } else {
                  const day = parts[0].padStart(2, '0');
                  const month = parts[1].padStart(2, '0');
                  const year = parts[2];
                  dateKey = `${year}-${month}-${day}`;
                }
              }
            }
          }
          
          if (!dateKey || dateKey.length !== 10 || isNaN(Date.parse(dateKey))) {
            console.warn(`Data inválida na linha ${i}:`, rawDataVal);
            continue;
          }
          
          const rawNome = r[colNomeIdx];
          if (!rawNome) continue;
          
          const employeeName = String(rawNome).trim();
          const role = colFuncao !== -1 && r[colFuncao] ? String(r[colFuncao]).trim() : '';
          const machineName = colEquipamentoIdx !== -1 && r[colEquipamentoIdx] ? String(r[colEquipamentoIdx]).trim() : '';
          const worksiteName = r[colObraIdx] ? String(r[colObraIdx]).trim() : 'PÁTEO';
          
          let hours = 9; // Horário padrão
          if (colHoras !== -1 && r[colHoras] !== undefined) {
            const hVal = parseFloat(r[colHoras]);
            if (!isNaN(hVal)) {
              hours = hVal;
            }
          }
          
          const observation = colObservacao !== -1 && r[colObservacao] ? String(r[colObservacao]).trim() : '';
          
          // Mapear custo da linha
          let rowCost = 0;
          if (colCustoIdx !== -1 && r[colCustoIdx] !== undefined && r[colCustoIdx] !== null) {
            rowCost = parseExcelCost(r[colCustoIdx]);
          }

          // Regra Especial de Chuva: Obra PÁTEO e Observação CHUVA -> Realoca para a obra CHUVA
          let finalWorksiteName = worksiteName;
          const cleanObra = worksiteName.trim().toUpperCase();
          const cleanObs = observation.trim().toUpperCase();
          if ((cleanObra === 'PÁTEO' || cleanObra === 'PATEO' || cleanObra === 'PATIO' || cleanObra === 'PÁTIO') && cleanObs === 'CHUVA') {
            finalWorksiteName = 'CHUVA';
          }
          
          parsedRows.push({
            dateKey,
            employeeName,
            role,
            machineName,
            worksiteName: finalWorksiteName,
            hours,
            observation,
            rowCost
          });
        }
        
        if (parsedRows.length === 0) {
          alert("Nenhuma alocação válida encontrada na planilha.");
          return;
        }
        
        // Agrupar linhas por data
        const groupedByDate: { [dateKey: string]: typeof parsedRows } = {};
        for (const prow of parsedRows) {
          if (!groupedByDate[prow.dateKey]) {
            groupedByDate[prow.dateKey] = [];
          }
          groupedByDate[prow.dateKey].push(prow);
        }
        
        // Processar alocações dia por dia
        for (const dateKey of Object.keys(groupedByDate)) {
          const dateRows = groupedByDate[dateKey];
          
          // Sobrescrever: limpar tudo o que existia nesta data específica
          updatedAllocations[dateKey] = {};
          updatedObservations[dateKey] = {};
          updatedResourceLinks[dateKey] = {};
          updatedPartialAllocations[dateKey] = {};
          
          // Agrupar as linhas do dia por funcionário
          const groupedByEmployee: { [empName: string]: typeof dateRows } = {};
          for (const drow of dateRows) {
            const cleanEmpName = drow.employeeName.toUpperCase();
            if (!groupedByEmployee[cleanEmpName]) {
              groupedByEmployee[cleanEmpName] = [];
            }
            groupedByEmployee[cleanEmpName].push(drow);
          }
          
          for (const empName of Object.keys(groupedByEmployee)) {
            const empRows = groupedByEmployee[empName];
            const firstRow = empRows[0];
            
            // O custo da planilha pertence sempre ao Funcionário (operador)
            const emp = findOrCreateEmployee(firstRow.employeeName, firstRow.role, firstRow.rowCost);
            
            // Verifica se o funcionário possui horas divididas (mais de 1 linha ou horas diferentes de 9)
            const isSplit = empRows.length > 1 || empRows.some(row => row.hours !== 9);
            
            const matchedRowsInfo = empRows.map(row => {
              const site = findOrCreateWorksite(row.worksiteName);
              let machine = null;
              if (row.machineName) {
                // Cria ou busca a máquina com o seu custo fixo tabelado
                machine = findOrCreateMachine(row.machineName);
                // Vincula equipamento -> operador na data correspondente
                updatedResourceLinks[dateKey][machine.id] = emp.id;
              }
              return { row, site, machine };
            });
            
            if (!isSplit) {
              // Alocação padrão de dia inteiro (9 horas)
              const { site, machine } = matchedRowsInfo[0];
              updatedAllocations[dateKey][emp.id] = site.id;
              
              if (machine) {
                updatedAllocations[dateKey][machine.id] = site.id;
              }
              
              // Observação
              const obs = matchedRowsInfo[0].row.observation;
              if (obs) {
                const currentObs = updatedObservations[dateKey][site.id] || '';
                if (!currentObs.includes(obs)) {
                  updatedObservations[dateKey][site.id] = (currentObs ? currentObs + '\n' + obs : obs).trim();
                }
              }
              
              // Limpa divisões de horas antigas se existirem
              if (updatedPartialAllocations[dateKey][emp.id]) {
                delete updatedPartialAllocations[dateKey][emp.id];
              }
              if (machine && updatedPartialAllocations[dateKey][machine.id]) {
                delete updatedPartialAllocations[dateKey][machine.id];
              }
            } else {
              // Alocação dividida (Parcial)
              const employeePartials = matchedRowsInfo.map(({ row, site }) => ({
                resourceId: emp.id,
                worksiteId: site.id,
                hours: row.hours
              }));
              updatedPartialAllocations[dateKey][emp.id] = employeePartials;
              
              // Alocação principal recebe a primeira obra para não ficar órfão
              updatedAllocations[dateKey][emp.id] = matchedRowsInfo[0].site.id;
              
              matchedRowsInfo.forEach(({ row, site, machine }) => {
                if (machine) {
                  const machinePartials = [{
                    resourceId: machine.id,
                    worksiteId: site.id,
                    hours: row.hours
                  }];
                  
                  if (!updatedPartialAllocations[dateKey][machine.id]) {
                    updatedPartialAllocations[dateKey][machine.id] = [];
                  }
                  updatedPartialAllocations[dateKey][machine.id].push(...machinePartials);
                  
                  updatedAllocations[dateKey][machine.id] = site.id;
                }
                
                // Observação
                const obs = row.observation;
                if (obs) {
                  const currentObs = updatedObservations[dateKey][site.id] || '';
                  if (!currentObs.includes(obs)) {
                    updatedObservations[dateKey][site.id] = (currentObs ? currentObs + '\n' + obs : obs).trim();
                  }
                }
              });
            }
          }
        }
        
        // === LÓGICA DE DEMISSÃO AUTOMÁTICA (DISMISSED_AT) COM TOLERÂNCIA DE 5 DIAS ===
        const sortedImportedDates = Object.keys(groupedByDate).sort();
        if (sortedImportedDates.length > 0) {
          const firstImportedDateStr = sortedImportedDates[0];
          const lastImportedDateStr = sortedImportedDates[sortedImportedDates.length - 1];
          const firstImportedDate = parseISO(firstImportedDateStr);
          const lastImportedDate = parseISO(lastImportedDateStr);
          
          // Intervalo total de dias na planilha importada
          const sheetIntervalDays = Math.round(Math.abs(lastImportedDate.getTime() - firstImportedDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          
          // Mapear a última data de aparição de cada recurso na planilha
          const lastAppearedDateMap: { [resId: string]: string } = {};
          
          for (const dateKey of sortedImportedDates) {
            const rowsForDate = groupedByDate[dateKey];
            for (const row of rowsForDate) {
              const cleanEmp = cleanEmployeeName(row.employeeName);
              const emp = updatedResources.find(r => r.type === 'employee' && cleanEmployeeName(r.name) === cleanEmp);
              if (emp) {
                lastAppearedDateMap[emp.id] = dateKey;
              }
              if (row.machineName) {
                const cleanMac = cleanMachineName(row.machineName);
                const machine = updatedResources.find(r => r.type === 'machine' && cleanMachineName(r.name) === cleanMac);
                if (machine) {
                  lastAppearedDateMap[machine.id] = dateKey;
                }
              }
            }
          }
          
          // Aplicar regras para cada recurso (funcionários e máquinas)
          for (const res of updatedResources) {
            if (res.type === 'machine') {
              res.dismissedAt = undefined;
              continue;
            }
            const lastAppearedDateStr = lastAppearedDateMap[res.id];
            
            if (lastAppearedDateStr) {
              // O recurso apareceu na planilha importada
              const lastAppearedDate = parseISO(lastAppearedDateStr);
              const daysSinceLastAppearance = Math.round(Math.abs(lastImportedDate.getTime() - lastAppearedDate.getTime()) / (1000 * 60 * 60 * 24));
              
              // Se a ausência for de 5 dias ou mais em relação ao final da planilha, definimos a demissão para o dia seguinte à última aparição
              if (daysSinceLastAppearance >= 5) {
                const nextDayDate = addDays(lastAppearedDate, 1);
                res.dismissedAt = format(nextDayDate, 'yyyy-MM-dd');
              } else {
                // Se ele apareceu no final da planilha (ausência < 5 dias), garantimos que ele continua ativo
                res.dismissedAt = undefined;
              }
            } else {
              // O recurso NÃO apareceu em nenhum dia da planilha
              // Só marcamos demissão se a planilha cobrir um período significativo (>= 5 dias)
              if (sheetIntervalDays >= 5) {
                // Se ele não tinha data de demissão cadastrada, ou se era posterior ao início do período importado
                if (!res.dismissedAt || res.dismissedAt >= firstImportedDateStr) {
                  const nextDayDate = addDays(lastImportedDate, 1);
                  res.dismissedAt = format(nextDayDate, 'yyyy-MM-dd');
                }
              }
            }
          }
        }
        
        // Atualiza os estados do React
        setResources(updatedResources);
        setWorksites(updatedWorksites);
        setAllocations(updatedAllocations);
        setObservations(updatedObservations);
        setResourceLinks(updatedResourceLinks);
        setPartialAllocations(updatedPartialAllocations);
        
        // Desbloqueia e ativa salvamento imediato no Supabase
        setDataLoaded(true);
        setLoadError(null);
        
        alert(`Planilha importada com sucesso!\nProcessadas alocações para ${Object.keys(groupedByDate).length} datas diferentes.\nFuncionários/máquinas atualizados no quadro.`);
        
      } catch (err: any) {
        console.error("Erro ao importar planilha:", err);
        alert(`Erro ao ler a planilha: ${err.message || err}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportFile = (file: File) => {
    if (file.name.endsWith('.json')) {
      handleImportBackup(file);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      handleImportExcel(file);
    } else {
      alert("Formato de arquivo não suportado. Escolha um arquivo de backup (.json) ou planilha de alocação (.xlsx, .xls).");
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      {loadError && (
        <div style={{
          background: '#fee2e2',
          borderBottom: '2px solid #fca5a5',
          color: '#991b1b',
          padding: '12px 16px',
          textAlign: 'center',
          fontWeight: '700',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <span>⚠️ {loadError}</span>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              background: '#b91c1c',
              color: 'white',
              border: 'none',
              padding: '4px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '11px',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#991b1b'}
            onMouseOut={(e) => e.currentTarget.style.background = '#b91c1c'}
          >
            Recarregar Página
          </button>
        </div>
      )}
      {/* HEADER */}
      <header style={{
        background: 'white',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        padding: '8px 16px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '17px', fontWeight: '900', color: '#0f172a', marginBottom: '1px', letterSpacing: '-0.5px' }}>
              COLLINE ENGENHARIA
            </h1>
            <p style={{ fontSize: '8px', color: '#3b82f6', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '2px' }}>
              Quadro de Alocação Digital
            </p>
          </div>

          <div style={{ display: 'flex', gap: '4px', background: '#f8fafc', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <button
              onClick={() => setActiveTab('board')}
              style={{
                padding: '6px 14px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'board' ? '#3b82f6' : 'transparent',
                color: activeTab === 'board' ? 'white' : '#64748b',
                fontWeight: '700',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: activeTab === 'board' ? '0 4px 10px rgba(59, 130, 246, 0.3)' : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <LayoutDashboard size={14} /> Quadro
            </button>
            <button
              onClick={() => setActiveTab('fuel')}
              style={{
                padding: '6px 14px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'fuel' ? '#3b82f6' : 'transparent',
                color: activeTab === 'fuel' ? 'white' : '#64748b',
                fontWeight: '700',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: activeTab === 'fuel' ? '0 4px 10px rgba(59, 130, 246, 0.3)' : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <FuelIcon size={14} /> Combustível
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              style={{
                padding: '6px 14px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'analytics' ? '#3b82f6' : 'transparent',
                color: activeTab === 'analytics' ? 'white' : '#64748b',
                fontWeight: '700',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: activeTab === 'analytics' ? '0 4px 10px rgba(59, 130, 246, 0.3)' : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <PieChartIcon size={14} /> Painel Analítico
            </button>
          </div>
        </div>

        {(activeTab === 'board' || activeTab === 'fuel') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '5px 12px', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' }}>
            <button onClick={() => setCurrentDate(subDays(currentDate, 1))} className="btn" style={{ padding: '5px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              <ChevronLeft size={16} />
            </button>
            <div style={{ position: 'relative', minWidth: '170px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              <div style={{ padding: '0 12px', fontWeight: '800', fontSize: '13px', color: '#1e293b', textAlign: 'center', pointerEvents: 'none' }}>
                <CalendarIcon size={14} style={{ display: 'inline', marginRight: '6px', color: '#3b82f6' }} />
                {format(currentDate, "dd 'de' MMMM", { locale: ptBR })}
              </div>
            </div>
            <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="btn" style={{ padding: '5px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* CONTROLES DO QUADRO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Status da Alocação */}
          <button
            onClick={handleToggleFinalAllocation}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '10px',
              border: '2px solid',
              borderColor: currentMetadata.isFinalAllocation ? '#10b981' : '#f59e0b',
              background: currentMetadata.isFinalAllocation ? '#ecfdf5' : '#fffbeb',
              color: currentMetadata.isFinalAllocation ? '#065f46' : '#92400e',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '700',
              transition: 'all 0.2s'
            }}
          >
            <div style={{
              width: '14px',
              height: '14px',
              borderRadius: '4px',
              background: currentMetadata.isFinalAllocation ? '#10b981' : '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '9px'
            }}>
              {currentMetadata.isFinalAllocation ? '✓' : '📋'}
            </div>
            <span>{currentMetadata.isFinalAllocation ? 'Alocação Final' : 'Em Planejamento'}</span>
          </button>

          {/* Copiar/Colar */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={handleCopyBoard}
              className="btn"
              style={{
                background: '#f1f5f9',
                color: '#475569',
                border: 'none',
                fontSize: '11px',
                padding: '6px 10px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
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
                fontSize: '11px',
                padding: '6px 10px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: '700',
                cursor: clipboard ? 'pointer' : 'not-allowed',
                opacity: clipboard ? 1 : 0.6
              }}
            >
              📥 Colar
            </button>
          </div>

          {/* Export/Import/Image */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={handleExportData}
              className="btn btn-primary"
              style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Baixar Backup de Dados (JSON)"
            >
              <FileJson size={13} /> Backup
            </button>
            <button
              onClick={handleExportImage}
              className="btn"
              style={{
                fontSize: '11px',
                padding: '6px 10px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              title="Baixar Foto do Quadro (PDF)"
            >
              <Camera size={13} /> Imagem
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="btn btn-success"
              style={{
                fontSize: '11px',
                padding: '6px 10px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: '700',
                cursor: 'pointer',
                border: 'none',
                color: 'white',
                background: '#10b981'
              }}
              title="Importar Backup (JSON) ou Planilha Excel (.xlsx, .xls)"
            >
              <Upload size={13} /> Importar
            </button>
            {/* Botão de Logout */}
            <button
              onClick={async () => {
                if (confirm('Deseja sair do sistema?')) await signOut();
              }}
              className="btn"
              style={{
                fontSize: '11px',
                padding: '6px 10px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              title={`Sair (${user?.email})`}
            >
              <LogOut size={13} /> Sair
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO */}
      {activeTab === 'board' ? (
        <main ref={boardRef} style={{ padding: '18px 20px', maxWidth: '1600px', margin: '0 auto' }} className="animate-fade-in">
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
          observations={observations}
          resourceLinks={resourceLinks}
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
            onMergeWorksites={handleMergeWorksites}
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
      {
        showImportModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                  📥 Importar Dados / Planilha
                </h3>
                <button onClick={() => setShowImportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                  <X size={20} />
                </button>
              </div>
              
              <div style={{ fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '12px', lineHeight: '1.5' }}>
                <p>Escolha o arquivo para importar no quadro de alocação:</p>
                
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <strong>1. Planilha de Alocação (.xlsx, .xls)</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    Soma as alocações da planilha ao histórico existente (sem apagar outros meses). Deve conter as colunas: <em>DATA, NOME, FUNÇÃO, EQUIPAMENTO, OBRA, OBSERVAÇÃO, HORAS TRABALHADAS</em>.
                  </p>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <strong>2. Backup Completo (.json)</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    Restaura o sistema completo para o estado em que o backup foi gerado.
                  </p>
                </div>
                
                <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '8px', border: '1px solid #bfdbfe', color: '#1e40af' }}>
                  <strong>🌧️ Regra Especial de Chuva:</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                    Quando a obra for <strong>PÁTEO</strong> (ou Pátio) e a observação for <strong>CHUVA</strong>, os recursos serão alocados automaticamente em uma obra com o nome de <strong>CHUVA</strong>.
                  </p>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button onClick={() => setShowImportModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Fechar
                </button>
                <label className="btn btn-success" style={{ fontSize: '12px', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', background: '#10b981', color: 'white', border: 'none' }}>
                  Selecionar Arquivo
                  <input
                    type="file"
                    className="hidden"
                    accept=".json,.xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleImportFile(file);
                        setShowImportModal(false);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}



export default App;
