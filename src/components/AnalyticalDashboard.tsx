import React, { useState, useMemo } from 'react';
import {
    TrendingUp,
    AlertTriangle,
    Calendar,
    Building2,
    Droplet,
    Tractor,
    ChevronLeft,
    ChevronRight,
    ArrowUpRight,
    CheckCircle2
} from 'lucide-react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, addMonths, addDays, subDays, isWeekend, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
import type { Resource, Worksite, AllocationData, OvertimeData, MaintenanceData, PartialAllocationsData, FuelData, FuelQuoteData, AllocationMetadata } from '../types';

interface AnalyticalDashboardProps {
    resources: Resource[];
    allocations: AllocationData;
    overtime: OvertimeData;
    maintenanceHistory: MaintenanceData;
    partialAllocations: PartialAllocationsData;
    fuelData: FuelData;
    fuelQuotes: FuelQuoteData;
    worksites: Worksite[];
    selectedMonth: Date;
    onMonthChange: (date: Date) => void;
    allocationMetadata: AllocationMetadata;
}

export const AnalyticalDashboard: React.FC<AnalyticalDashboardProps> = ({
    resources,
    allocations,
    overtime,
    maintenanceHistory,
    partialAllocations,
    fuelData,
    fuelQuotes,
    worksites,
    selectedMonth,
    onMonthChange,
    allocationMetadata
}) => {
    const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('monthly');

    const stats = useMemo(() => {
        const start = viewMode === 'monthly' ? startOfMonth(selectedMonth) : selectedMonth;
        const end = viewMode === 'monthly' ? endOfMonth(selectedMonth) : selectedMonth;
        const days = eachDayOfInterval({ start, end });

        let totalCost = 0;
        let totalRealCost = 0;
        let totalEstimatedCost = 0;
        let totalFuelCost = 0;
        let totalRainCost = 0;
        let totalYardCost = 0;

        const worksiteCosts: { [key: string]: number } = { 'pateo': 0 };
        const dailyCosts: { date: string; custo: number }[] = [];
        const worksiteDailyData: { date: string;[worksiteName: string]: any }[] = [];
        const monthlyData: { name: string; total: number }[] = [];

        // 1. Custos de Combustível
        days.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dailyQuote = fuelQuotes[dateKey] || 0;
            const dailyFuelEntries = fuelData[dateKey] || {};

            let dailyFuelTotal = 0;
            Object.values(dailyFuelEntries).forEach(entry => {
                if (entry && entry.fuelLiters) {
                    dailyFuelTotal += entry.fuelLiters * dailyQuote;
                }
            });
            totalFuelCost += dailyFuelTotal;
        });

        // 2. Determinar Estado Inicial de Manutenção e Loop Principal (Exclusividade)
        const sortedHistoryDates = Object.keys(maintenanceHistory).sort();

        // Inicializar estado baseado no histórico ANTERIOR ao start (Lógica Independente)
        const initialMaintState: { [resId: string]: { inMaintenance: boolean; reason: string } } = {};

        resources.forEach(res => {
            // 1. Encontrar última entrada de manutenção ANTES do início do período
            const pastDates = sortedHistoryDates.filter(d => d < format(start, 'yyyy-MM-dd')).reverse();
            let lastMaintEntry: { inMaintenance: boolean; reason: string } | undefined;
            let lastMaintDate: string | undefined;

            for (const d of pastDates) {
                const entry = maintenanceHistory[d]?.[res.id];
                if (entry !== undefined) {
                    lastMaintEntry = {
                        inMaintenance: typeof entry === 'object' ? entry.inMaintenance : entry,
                        reason: (typeof entry === 'object' ? entry.reason : '') || 'Manutenção'
                    };
                    lastMaintDate = d;
                    break;
                }
            }

            if (lastMaintEntry?.inMaintenance && lastMaintDate) {
                // 2. Verificar se houve alocação que cancela a manutenção ENTRE a última data e o início do mês
                const checkStart = lastMaintDate;
                const checkEnd = format(start, 'yyyy-MM-dd');

                const intermediateDates = Object.keys(allocations).filter(d => d > checkStart && d < checkEnd);
                const intermediatePartials = Object.keys(partialAllocations).filter(d => d > checkStart && d < checkEnd);

                let hasCancelingAlloc = false;

                // Checa alocações completas
                for (const d of intermediateDates) {
                    const alloc = allocations[d]?.[res.id];
                    if (alloc && alloc !== 'pateo' && alloc !== 'chuva') {
                        hasCancelingAlloc = true;
                        break;
                    }
                }

                // Checa alocações parciais
                if (!hasCancelingAlloc) {
                    for (const d of intermediatePartials) {
                        const parts = partialAllocations[d]?.[res.id] || [];
                        if (parts.some(p => p.worksiteId !== 'pateo' && p.worksiteId !== 'chuva')) {
                            hasCancelingAlloc = true;
                            break;
                        }
                    }
                }

                // Só mantém em manutenção se NÃO houve alocação canceladora
                if (!hasCancelingAlloc) {
                    initialMaintState[res.id] = lastMaintEntry;
                }
            }
        });

        const currentMaintState = { ...initialMaintState };
        const maintenanceIntervalsMap: { [resId: string]: { start: Date, end: Date, days: number, reason: string }[] } = {};

        // Para recursos que JÁ ESTAVAM em manutenção antes do período, cria intervalo inicial
        Object.keys(initialMaintState).forEach(resId => {
            if (initialMaintState[resId].inMaintenance) {
                // Encontra quando a manutenção começou
                const pastDates = sortedHistoryDates.filter(d => d < format(start, 'yyyy-MM-dd')).reverse();
                let maintStartDate: Date | null = null;

                for (const date of pastDates) {
                    const entry = maintenanceHistory[date]?.[resId];
                    const isInMaint = typeof entry === 'object' ? entry.inMaintenance : entry;

                    if (isInMaint === true) {
                        maintStartDate = parseISO(date);
                    } else if (isInMaint === false) {
                        break; // Parou de procurar se encontrou um false
                    }
                }

                // Cria intervalo do início da manutenção até o primeiro dia do período
                if (maintStartDate) {
                    maintenanceIntervalsMap[resId] = [{
                        start: maintStartDate,
                        end: subDays(start, 1), // Até ontem (antes do período começar)
                        days: 0, // Não conta dias úteis de antes do período
                        reason: initialMaintState[resId].reason
                    }];
                }
            }
        });

        days.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const isFinal = allocationMetadata[dateKey]?.isFinalAllocation;
            let dailyTotal = 0;

            const dailyAllocations = allocations[dateKey] || {};
            const dailyPartials = partialAllocations[dateKey] || {};

            const dailyWorksiteCosts: { [key: string]: number } = {};
            worksites.forEach(w => dailyWorksiteCosts[w.name] = 0);
            dailyWorksiteCosts['Pátio'] = 0;

            resources.forEach(resource => {
                if (resource.ignoreCost) return;

                // --- LÓGICA DE MANUTENÇÃO STICKY ---
                const explicitAlloc = dailyAllocations[resource.id];
                const explicitMaintEntry = maintenanceHistory[dateKey]?.[resource.id];
                const explicitPartials = dailyPartials[resource.id] || [];

                // Determina se houve entrada explícita (True ou False)
                let explicitInMaint: boolean | undefined = undefined;
                if (explicitMaintEntry !== undefined) {
                    explicitInMaint = typeof explicitMaintEntry === 'object' ? explicitMaintEntry.inMaintenance : explicitMaintEntry;
                }

                if (explicitInMaint === true) {
                    currentMaintState[resource.id] = {
                        inMaintenance: true,
                        reason: (typeof explicitMaintEntry === 'object' ? explicitMaintEntry.reason : '') || 'Manutenção'
                    };
                } else if (explicitInMaint === false) {
                    delete currentMaintState[resource.id];
                } else {
                    // Se não houve entrada manual HOJE, verifica se alocação REAL cancela o estado anterior
                    const hasRealAlloc = (explicitAlloc && explicitAlloc !== 'pateo' && explicitAlloc !== 'chuva') ||
                        explicitPartials.some(p => p.worksiteId !== 'pateo' && p.worksiteId !== 'chuva');

                    if (hasRealAlloc) {
                        delete currentMaintState[resource.id];
                    }
                }

                // Verifica se está efetivamente em manutenção HOJE
                const inMaintenance = !!currentMaintState[resource.id]?.inMaintenance;

                // Registro de Intervalos para Tabela
                if (inMaintenance) {
                    if (!maintenanceIntervalsMap[resource.id]) maintenanceIntervalsMap[resource.id] = [];
                    const intervals = maintenanceIntervalsMap[resource.id];

                    // Tenta estender o último intervalo se for consecutivo (ontem)
                    const lastInterval = intervals[intervals.length - 1];
                    const yesterday = subDays(day, 1);

                    if (lastInterval && isSameDay(lastInterval.end, yesterday) && lastInterval.reason === currentMaintState[resource.id].reason) {
                        lastInterval.end = day;
                        if (isFinal) lastInterval.days++; // Conta dias úteis perdidos
                    } else {
                        // Novo intervalo
                        intervals.push({
                            start: day,
                            end: day,
                            days: isFinal ? 1 : 0, // Primeiro dia
                            reason: currentMaintState[resource.id].reason || 'Manutenção'
                        });
                    }

                    return; // Pula custos se em manutenção
                }

                // --- LÓGICA DE CUSTOS (Se não está em manutenção) ---

                const allocation = explicitAlloc;
                const partials = explicitPartials;

                let allocatedToSite = false;

                // OCIOSIDADE (PÁTIO):
                const isIdle = !isWeekend(day) && isFinal && (allocation === 'pateo' || !allocation) && partials.length === 0;

                if (isIdle) {
                    const idleCost = resource.costPerDay;
                    totalYardCost += idleCost;
                    worksiteCosts['pateo'] += idleCost;
                    dailyWorksiteCosts['Pátio'] += idleCost;

                    // Soma ao total da empresa
                    dailyTotal += idleCost;
                }

                if (partials.length > 0) {
                    partials.forEach(p => {
                        if (p.worksiteId !== 'pateo' && p.worksiteId !== 'chuva') {
                            const hoursFraction = p.hours / 8;
                            const cost = resource.costPerDay * hoursFraction;

                            dailyTotal += cost;

                            if (!worksiteCosts[p.worksiteId]) worksiteCosts[p.worksiteId] = 0;
                            worksiteCosts[p.worksiteId] += cost;

                            const wsName = worksites.find(w => w.id === p.worksiteId)?.name;
                            if (wsName) dailyWorksiteCosts[wsName] = (dailyWorksiteCosts[wsName] || 0) + cost;

                            allocatedToSite = true;
                        } else if (p.worksiteId === 'chuva') {
                            totalRainCost += resource.costPerDay * (p.hours / 8);
                        }
                    });
                }

                if (partials.length === 0 && allocation && allocation !== 'pateo' && allocation !== 'chuva') {
                    dailyTotal += resource.costPerDay;

                    if (!worksiteCosts[allocation]) worksiteCosts[allocation] = 0;
                    worksiteCosts[allocation] += resource.costPerDay;

                    const wsName = worksites.find(w => w.id === allocation)?.name;
                    if (wsName) dailyWorksiteCosts[wsName] = (dailyWorksiteCosts[wsName] || 0) + resource.costPerDay;

                    allocatedToSite = true;
                }

                if (partials.length === 0 && allocation === 'chuva') {
                    totalRainCost += resource.costPerDay;
                }

                const ot = overtime[dateKey]?.[resource.id];
                if (ot && allocatedToSite) {
                    const hourlyRate = resource.costPerDay / 8;
                    const otCost = ot.hours * hourlyRate * ot.multiplier;
                    dailyTotal += otCost;

                    if (allocation && allocation !== 'pateo' && allocation !== 'chuva') {
                        worksiteCosts[allocation] += otCost;
                        const wsName = worksites.find(w => w.id === allocation)?.name;
                        if (wsName) dailyWorksiteCosts[wsName] += otCost;

                    } else if (partials.length > 0) {
                        const w = partials.find(p => p.worksiteId !== 'pateo' && p.worksiteId !== 'chuva');
                        if (w) {
                            worksiteCosts[w.worksiteId] += otCost;
                            const wsName = worksites.find(ws => ws.id === w.worksiteId)?.name;
                            if (wsName) dailyWorksiteCosts[wsName] += otCost;
                        }
                    }
                }
            });

            dailyCosts.push({
                date: format(day, 'dd/MM'),
                custo: dailyTotal
            });

            worksiteDailyData.push({
                date: format(day, 'dd/MM'),
                ...dailyWorksiteCosts
            });

            totalCost += dailyTotal;
            if (isFinal) {
                totalRealCost += dailyTotal;
            } else {
                totalEstimatedCost += dailyTotal;
            }
        });

        // 3. Ranking e Gráficos (Incluindo Pátio)
        const pieData = Object.entries(worksiteCosts).map(([id, value], index) => {
            if (id === 'pateo') return { name: 'Pátio (Ociosidade)', value, color: '#94a3b8' };
            const ws = worksites.find(w => w.id === id);
            return {
                name: ws ? ws.name : 'Desconhecido',
                value,
                color: ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6'][index % 6]
            };
        }).filter(d => d.value > 0);

        const rankingData = pieData.sort((a, b) => b.value - a.value);

        // 4. Preparar Lista Final de Intervalos de Manutenção para Display
        const maintenanceIntervals: { resourceId: string; start: string; end: string; days: number; reason: string; cost: number }[] = [];

        // Para cada recurso que teve manutenção, verifica se ainda está ativo no fim do período
        Object.keys(maintenanceIntervalsMap).forEach(resId => {
            maintenanceIntervalsMap[resId].forEach(interval => {
                const res = resources.find(r => r.id === resId);

                // Se o intervalo termina no último dia E o recurso ainda está em manutenção,
                // expande até o fim do período visualizado
                let finalEnd = interval.end;
                const lastDay = days[days.length - 1];

                if (isSameDay(interval.end, lastDay) && currentMaintState[resId]?.inMaintenance) {
                    finalEnd = lastDay; // Garante que vai até o fim do mês visualizado
                }

                const cost = res ? interval.days * res.costPerDay : 0;
                maintenanceIntervals.push({
                    resourceId: resId,
                    start: format(interval.start, 'yyyy-MM-dd'),
                    end: format(finalEnd, 'yyyy-MM-dd'),
                    days: interval.days,
                    reason: interval.reason,
                    cost: cost
                });
            })
        });


        // 5. Ociosidade Detalhada (Lista Lateral) - SEM MANUTENÇÃO (Recalculado no loop principal mas precisa agregar aqui)

        const idleResources: { name: string; type: string; days: number }[] = [];
        const tempMaintState = { ...initialMaintState }; // CORRIGIDO: Usa initialMaintState que foi definido acima

        resources.forEach(res => {
            if (res.isAdministrative || res.ignoreCost) return;
            let idleDays = 0;

            // Re-simular a linha do tempo para este recurso
            days.forEach(day => {
                const dKey = format(day, 'yyyy-MM-dd');
                const isFinal = allocationMetadata[dKey]?.isFinalAllocation;
                const explicitAlloc = allocations[dKey]?.[res.id];
                const explicitMaintEntry = maintenanceHistory[dKey]?.[res.id];
                const explicitInMaint = explicitMaintEntry ? (typeof explicitMaintEntry === 'object' ? explicitMaintEntry.inMaintenance : explicitMaintEntry) : undefined;
                const explicitPartials = partialAllocations[dKey]?.[res.id] || [];

                if (explicitInMaint === true) {
                    tempMaintState[res.id] = { inMaintenance: true, reason: '' };
                } else if (explicitAlloc || explicitPartials.length > 0) {
                    delete tempMaintState[res.id];
                } else if (explicitInMaint === false) {
                    delete tempMaintState[res.id];
                }

                const inMaint = !!tempMaintState[res.id]?.inMaintenance;

                if (!inMaint && !isWeekend(day) && isFinal && (explicitAlloc === 'pateo' || !explicitAlloc) && explicitPartials.length === 0) {
                    idleDays++;
                }
            });

            if (idleDays > 0) {
                idleResources.push({ name: res.name, type: res.type, days: idleDays });
            }
        });

        return {
            totalCost,
            totalRealCost,
            totalEstimatedCost,
            totalFuelCost,
            totalRainCost,
            pieData,
            lineData: dailyCosts,
            monthlyData,
            rankingData,
            worksiteDailyData,
            idleResources: idleResources.sort((a, b) => b.days - a.days).slice(0, 20),
            maintenanceIntervals: maintenanceIntervals.sort((a, b) => b.start.localeCompare(a.start))
        };

    }, [resources, allocations, overtime, maintenanceHistory, partialAllocations, fuelData, fuelQuotes, worksites, selectedMonth, viewMode, allocationMetadata]);

    const handleNavigation = (direction: 'prev' | 'next') => {
        if (viewMode === 'monthly') {
            onMonthChange(direction === 'prev' ? startOfMonth(addMonths(selectedMonth, -1)) : startOfMonth(addMonths(selectedMonth, 1)));
        } else {
            onMonthChange(direction === 'prev' ? subDays(selectedMonth, 1) : addDays(selectedMonth, 1));
        }
    };

    return (
        <div className="dashboard-container" style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
            {/* Header com Filtros */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', margin: 0 }}>Dashboard Analítico</h2>
                    <p style={{ color: '#64748b', margin: '4px 0 0 0', fontWeight: '600' }}>
                        {viewMode === 'monthly' ? 'Visão Mensal Consolidada' : 'Visão Diária Detalhada'}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    {/* Toggle Display Mode */}
                    <div style={{ background: 'white', padding: '4px', borderRadius: '12px', display: 'flex', gap: '4px', border: '1px solid #e2e8f0' }}>
                        <button
                            onClick={() => setViewMode('monthly')}
                            style={{
                                padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: '800', cursor: 'pointer',
                                background: viewMode === 'monthly' ? '#e0f2fe' : 'transparent',
                                color: viewMode === 'monthly' ? '#0284c7' : '#64748b'
                            }}
                        >
                            Mensal
                        </button>
                        <button
                            onClick={() => setViewMode('daily')}
                            style={{
                                padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: '800', cursor: 'pointer',
                                background: viewMode === 'daily' ? '#e0f2fe' : 'transparent',
                                color: viewMode === 'daily' ? '#0284c7' : '#64748b'
                            }}
                        >
                            Diário
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', background: 'white', padding: '6px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <button onClick={() => handleNavigation('prev')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '8px', color: '#64748b' }}><ChevronLeft size={20} /></button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', fontWeight: '800', color: '#1e293b' }}>
                            <Calendar size={18} color="#3b82f6" />
                            {viewMode === 'monthly'
                                ? format(selectedMonth, 'MMMM yyyy', { locale: ptBR }).toUpperCase()
                                : format(selectedMonth, "dd 'de' MMMM", { locale: ptBR }).toUpperCase()
                            }
                        </div>
                        <button onClick={() => handleNavigation('next')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '8px', color: '#64748b' }}><ChevronRight size={20} /></button>
                    </div>
                </div>
            </div>

            {/* Grid de Cards Principais */}
            {/* Grid de Cards Principais */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>

                {/* 1. Custo TOTAL (Soma Geral) */}
                <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '24px', borderRadius: '24px', color: 'white', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '14px' }}><TrendingUp size={24} /></div>
                        <ArrowUpRight size={20} color="#4ade80" />
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Custo Líquido Total</div>
                    <div style={{ fontSize: '28px', fontWeight: '900', margin: '4px 0', letterSpacing: '-0.02em' }}>R$ {stats.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>Real + Estimado</div>
                </div>

                {/* 2. Custo REAL (Finalizado) */}
                <div style={{ background: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ background: '#dcfce7', padding: '10px', borderRadius: '14px' }}><CheckCircle2 size={24} color="#166534" /></div>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Custo Líquido Real</div>
                    <div style={{ fontSize: '26px', fontWeight: '900', margin: '4px 0', color: '#166534' }}>R$ {stats.totalRealCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: '11px', color: '#166534', fontWeight: '700' }}>Alocações Finalizadas</div>
                </div>

                {/* 3. Custo ESTIMADO (Planejamento) */}
                <div style={{ background: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '14px' }}><Calendar size={24} color="#3b82f6" /></div>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Custo Líquido Estimado</div>
                    <div style={{ fontSize: '26px', fontWeight: '900', margin: '4px 0', color: '#3b82f6' }}>R$ {stats.totalEstimatedCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: '700' }}>Alocações em Planejamento</div>
                </div>
            </div>

            {/* Linha Secundária: Diesel e Chuva */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                {/* Custo Diesel */}
                <div style={{ background: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ background: '#ecfdf5', padding: '10px', borderRadius: '14px' }}><Droplet size={24} color="#10b981" /></div>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Consumo de Diesel</div>
                    <div style={{ fontSize: '24px', fontWeight: '900', margin: '4px 0', color: '#0f172a' }}>R$ {stats.totalFuelCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '700' }}>Baseado na Cotação Diária</div>
                </div>

                {/* Custo Chuva */}
                <div style={{ background: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '14px' }}><Droplet size={24} color="#3b82f6" /></div>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Custo Improd. Climática (Chuvas)</div>
                    <div style={{ fontSize: '24px', fontWeight: '900', margin: '4px 0', color: '#0f172a' }}>R$ {stats.totalRainCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
            </div>

            {/* Ranking e Gráfico Pizza */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                {/* Ranking de Custos (com Pátio) */}
                <div style={{ background: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ background: '#f0f9ff', padding: '8px', borderRadius: '10px', color: '#3b82f6' }}><Building2 size={20} /></div>
                        <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Ranking de Custos</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                        {stats.rankingData.map((item, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '10px', background: index === 0 ? '#f8fafc' : 'transparent', border: index === 0 ? '1px solid #e2e8f0' : 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : index === 2 ? '#b45309' : '#e2e8f0', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800' }}>
                                        {index + 1}
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>{item.name}</span>
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                                    R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        ))}
                        {stats.rankingData.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>Nenhum custo registrado no período.</div>
                        )}
                    </div>
                </div>

                {/* Gráfico Pizza */}
                <div style={{ background: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#1e293b', marginBottom: '16px' }}>Distribuição Percentual</h3>
                    <div style={{ height: '220px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={stats.pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {stats.pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                </Pie>
                                <RechartsTooltip formatter={(value: any) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />
                                <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Novo Gráfico: Evolução por Obra (APENAS NO MODO MENSAL) */}
            {viewMode === 'monthly' && (
                <div style={{ background: 'white', padding: '28px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', minHeight: '400px', marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', marginBottom: '24px' }}>Evolução de Custos por Obra</h3>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.worksiteDailyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                <RechartsTooltip formatter={(value: any) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />
                                <Legend />
                                {worksites
                                    .filter(w => stats.rankingData.some(r => r.name === w.name))
                                    .map((w, idx) => (
                                        <Line
                                            key={w.id}
                                            type="monotone"
                                            dataKey={w.name}
                                            stroke={['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6'][idx % 6]}
                                            strokeWidth={3}
                                            dot={false}
                                        />
                                    ))}
                                {/* Linha do Pátio Opcional */}
                                {stats.rankingData.some(r => r.name === 'Pátio (Ociosidade)') && (
                                    <Line type="monotone" dataKey="Pátio" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}


            {/* Alertas (Apenas Ociosidade, Manutenção removido) */}
            <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                {/* Ociosidade */}
                <div style={{ background: '#fff1f2', padding: '24px', borderRadius: '24px', border: '1px solid #fecdd3' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ background: '#fecdd3', padding: '8px', borderRadius: '10px', color: '#be123c' }}><AlertTriangle size={20} /></div>
                        <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#881337', margin: 0 }}>Recursos com Maior Ociosidade</h3>
                    </div>
                    <div style={{ marginBottom: '12px', fontSize: '11px', color: '#9f1239', opacity: 0.8 }}>
                        * Contabiliza apenas dias úteis com status "Alocação Final". Recursos em manutenção não contam.
                    </div>
                    {stats.idleResources.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                            {stats.idleResources.map((res, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.6)', borderRadius: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#9f1239' }}>{res.name}</span>
                                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: res.type === 'machine' ? '#fcd34d' : '#bae6fd', color: res.type === 'machine' ? '#92400e' : '#0369a1', fontWeight: '800' }}>
                                            {res.type === 'machine' ? 'MQ' : 'FUNC'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#be123c' }}>{res.days} dias parado</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', color: '#9f1239', padding: '20px', fontSize: '14px' }}>Sem alertas de ociosidade!</div>
                    )}
                </div>
            </div>

            {/* Histórico de Manutenção Consolidado */}
            <div style={{ background: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', marginTop: '32px', gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: '#fff7ed', padding: '8px', borderRadius: '12px' }}>
                        <Tractor size={20} color="#ea580c" />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>Histórico de Manutenção e Indisponibilidade</h3>
                </div>

                <div style={{ overflowX: 'auto', maxHeight: viewMode === 'monthly' ? '800px' : '400px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: 700, color: '#64748b' }}>MÁQUINA</th>
                                <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', fontWeight: 700, color: '#64748b' }}>PERÍODO INDISPONÍVEL</th>
                                <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', fontWeight: 700, color: '#64748b' }}>CUSTO INDISP.</th>
                                <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', fontWeight: 700, color: '#64748b' }}>IMPACTO (DIAS ÚTEIS)</th>
                                <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: 700, color: '#64748b' }}>MOTIVO REGISTRADO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.maintenanceIntervals.map((entry, idx) => {
                                const res = resources.find(r => r.id === entry.resourceId);
                                if (!res) return null;
                                return (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                                        <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {res.photo ? (
                                                <img src={res.photo} alt={res.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🚜</div>
                                            )}
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{res.name}</div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                            {format(parseISO(entry.start), 'dd/MM')} até {format(parseISO(entry.end), 'dd/MM')}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                background: '#fff7ed',
                                                color: '#c2410c',
                                                padding: '4px 10px',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                fontWeight: '800',
                                                border: '1px solid #ffedd5'
                                            }}>
                                                R$ {entry.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{ background: '#f1f5f9', color: '#64748b', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '800' }}>
                                                {entry.days} dias alocados
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>
                                            {entry.reason}
                                        </td>
                                    </tr>
                                );
                            })}
                            {stats.maintenanceIntervals.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>
                                        Nenhum registro de manutenção encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
