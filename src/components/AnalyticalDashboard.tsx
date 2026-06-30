import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
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
    Legend,
    BarChart,
    Bar
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
    observations: { [date: string]: { [worksiteId: string]: string } };
    resourceLinks: { [dateKey: string]: { [machineId: string]: string } };
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
    allocationMetadata,
    observations,
    resourceLinks
}) => {
    const [viewMode, setViewMode] = useState<'daily' | 'monthly' | '3months' | '6months' | '1year' | 'custom'>('monthly');
    const [customStart, setCustomStart] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [customEnd, setCustomEnd] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    // Estados "aplicados" — só mudam quando o usuário clica em Aplicar
    const [appliedStart, setAppliedStart] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [appliedEnd, setAppliedEnd] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [pendingCustom, setPendingCustom] = useState<boolean>(false);

    const getMaxHoursForDate = (date: Date): number => {
        const dayOfWeek = date.getDay(); // 0 = Domingo, 5 = Sexta
        if (dayOfWeek === 0 || dayOfWeek === 6) return 0;
        return dayOfWeek === 5 ? 8 : 9;
    };

    const stats = useMemo(() => {
        let start = startOfMonth(selectedMonth);
        let end = endOfMonth(selectedMonth);

        if (viewMode === 'daily') {
            start = selectedMonth;
            end = selectedMonth;
        } else if (viewMode === '3months') {
            start = startOfMonth(addMonths(selectedMonth, -2));
            end = endOfMonth(selectedMonth);
        } else if (viewMode === '6months') {
            start = startOfMonth(addMonths(selectedMonth, -5));
            end = endOfMonth(selectedMonth);
        } else if (viewMode === '1year') {
            start = startOfMonth(addMonths(selectedMonth, -11));
            end = endOfMonth(selectedMonth);
        } else if (viewMode === 'custom') {
            try {
                const cs = parseISO(appliedStart);
                const ce = parseISO(appliedEnd);
                start = cs;
                end = ce > cs ? ce : cs;
            } catch { /* usa padrão */ }
        }

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
                        if (parts.some(p => {
                            const ws = worksites.find(w => w.id === p.worksiteId);
                            const isRain = p.worksiteId === 'chuva' || ws?.name.toUpperCase() === 'CHUVA';
                            return p.worksiteId !== 'pateo' && !isRain;
                        })) {
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
            dailyWorksiteCosts['Chuva'] = 0;

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
                    const hasRealAlloc = (explicitAlloc && explicitAlloc !== 'pateo' && explicitAlloc !== 'chuva' && worksites.some(w => w.id === explicitAlloc && w.name.toUpperCase() !== 'CHUVA')) ||
                        explicitPartials.some(p => {
                            const ws = worksites.find(w => w.id === p.worksiteId);
                            const isRain = p.worksiteId === 'chuva' || ws?.name.toUpperCase() === 'CHUVA';
                            return p.worksiteId !== 'pateo' && !isRain;
                        });

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

                // OCIOSIDADE (PÁTIO) INTEGRAL:
                const isIdle = !isWeekend(day) && isFinal && (allocation === 'pateo' || !allocation) && partials.length === 0;

                if (isIdle) {
                    const idleCost = resource.type === 'machine' ? 0 : resource.costPerDay;
                    totalYardCost += idleCost;
                    worksiteCosts['pateo'] += idleCost;
                    dailyWorksiteCosts['Pátio'] += idleCost;

                    // Soma ao total da empresa
                    dailyTotal += idleCost;
                }

                if (partials.length > 0) {
                    const maxHours = getMaxHoursForDate(day);
                    partials.forEach(p => {
                        const hoursFraction = maxHours > 0 ? p.hours / maxHours : 0;
                        const cost = resource.costPerDay * hoursFraction;

                        const ws = worksites.find(w => w.id === p.worksiteId);
                        const isRain = p.worksiteId === 'chuva' || ws?.name.toUpperCase() === 'CHUVA';

                        if (p.worksiteId !== 'pateo' && !isRain && ws) {
                            dailyTotal += cost;

                            if (!worksiteCosts[p.worksiteId]) worksiteCosts[p.worksiteId] = 0;
                            worksiteCosts[p.worksiteId] += cost;

                            dailyWorksiteCosts[ws.name] = (dailyWorksiteCosts[ws.name] || 0) + cost;

                            allocatedToSite = true;
                        } else if (isRain) {
                            totalRainCost += cost;
                            dailyWorksiteCosts['Chuva'] += cost;
                        } else {
                            // Se for pátio OU obra não encontrada (desconhecida), conta como ociosidade
                            const yardCost = resource.type === 'machine' ? 0 : cost;
                            totalYardCost += yardCost;
                            worksiteCosts['pateo'] += yardCost;
                            dailyWorksiteCosts['Pátio'] += yardCost;
                            dailyTotal += yardCost;
                        }
                    });
                }

                if (partials.length === 0 && allocation) {
                    const ws = worksites.find(w => w.id === allocation);
                    const isRain = allocation === 'chuva' || ws?.name.toUpperCase() === 'CHUVA';

                    if (allocation !== 'pateo' && !isRain && ws) {
                        dailyTotal += resource.costPerDay;

                        if (!worksiteCosts[allocation]) worksiteCosts[allocation] = 0;
                        worksiteCosts[allocation] += resource.costPerDay;

                        dailyWorksiteCosts[ws.name] = (dailyWorksiteCosts[ws.name] || 0) + resource.costPerDay;

                        allocatedToSite = true;
                    } else if (isRain) {
                        totalRainCost += resource.costPerDay;
                        dailyWorksiteCosts['Chuva'] += resource.costPerDay;
                    } else if (allocation === 'pateo' || (allocation && !ws)) {
                        // Se for pátio explicitamente OU obra que foi deletada (!ws)
                        const cost = resource.type === 'machine' ? 0 : resource.costPerDay;
                        totalYardCost += cost;
                        worksiteCosts['pateo'] += cost;
                        dailyWorksiteCosts['Pátio'] += cost;
                        dailyTotal += cost;
                    }
                }

                const ot = overtime[dateKey]?.[resource.id];
                if (ot && allocatedToSite) {
                    const maxHours = getMaxHoursForDate(day);
                    const hourlyRate = maxHours > 0 ? resource.costPerDay / maxHours : resource.costPerDay / 8;
                    const otCost = ot.hours * hourlyRate * ot.multiplier;
                    dailyTotal += otCost;

                    const currentWs = worksites.find(w => w.id === allocation);
                    const isRain = allocation === 'chuva' || currentWs?.name.toUpperCase() === 'CHUVA';

                    if (allocation && allocation !== 'pateo' && !isRain && currentWs) {
                        if (!worksiteCosts[allocation]) worksiteCosts[allocation] = 0;
                        worksiteCosts[allocation] += otCost;
                        dailyWorksiteCosts[currentWs.name] += otCost;

                    } else if (partials.length > 0) {
                        const p = partials.find(p => {
                            const ws = worksites.find(w => w.id === p.worksiteId);
                            const isRain = p.worksiteId === 'chuva' || ws?.name.toUpperCase() === 'CHUVA';
                            return p.worksiteId !== 'pateo' && !isRain;
                        });
                        if (p) {
                            const ws = worksites.find(w => w.id === p.worksiteId);
                            if (ws) {
                                if (!worksiteCosts[p.worksiteId]) worksiteCosts[p.worksiteId] = 0;
                                worksiteCosts[p.worksiteId] += otCost;
                                dailyWorksiteCosts[ws.name] += otCost;
                            }
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
        const extendedColors = [
            '#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6',
            '#ec4899', '#14b8a6', '#f59e0b', '#6366f1', '#10b981', '#f43f5e',
            '#06b6d4', '#84cc16', '#d946ef', '#3b82f6', '#10b981', '#f97316',
            '#64748b', '#0369a1', '#15803d', '#b45309', '#be123c', '#7e22ce'
        ];

        const pieData = Object.entries(worksiteCosts).map(([id, value], index) => {
            if (id === 'pateo') return { name: 'Pátio (Ociosidade)', value, color: '#94a3b8' };
            const ws = worksites.find(w => w.id === id);
            return {
                name: ws ? ws.name : 'Desconhecido',
                value,
                color: extendedColors[index % extendedColors.length]
            };
        }).filter(d => d.value > 0);

        const rankingData = pieData.sort((a, b) => b.value - a.value);

        // --- DADOS ACUMULADOS PARA O NOVO GRÁFICO (Evolução Acumulada) ---
        const worksiteCumulativeData: { date: string;[worksiteName: string]: any }[] = [];
        const cumulativeCosts: { [key: string]: number } = {};
        
        // Inicializa zerado
        worksites.forEach(w => cumulativeCosts[w.name] = 0);
        cumulativeCosts['Pátio'] = 0;
        cumulativeCosts['Chuva'] = 0;

        worksiteDailyData.forEach(dailyRow => {
            // Soma o diário no acumulado
            Object.keys(dailyRow).forEach(key => {
                if (key !== 'date') {
                    cumulativeCosts[key] = (cumulativeCosts[key] || 0) + (dailyRow[key] as number);
                }
            });
            worksiteCumulativeData.push({
                date: dailyRow.date,
                ...cumulativeCosts
            });
        });
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
            worksiteCumulativeData,
            idleResources: idleResources.sort((a, b) => b.days - a.days).slice(0, 20),
            maintenanceIntervals: maintenanceIntervals.sort((a, b) => b.start.localeCompare(a.start))
        };

    }, [resources, allocations, overtime, maintenanceHistory, partialAllocations, fuelData, fuelQuotes, worksites, selectedMonth, viewMode, allocationMetadata, appliedStart, appliedEnd]);

    const handleNavigation = (direction: 'prev' | 'next') => {
        if (viewMode === 'daily') {
            onMonthChange(direction === 'prev' ? subDays(selectedMonth, 1) : addDays(selectedMonth, 1));
        } else {
            // Para mensal, 3m, 6m e 1ano, navegamos mês a mês
            onMonthChange(direction === 'prev' ? startOfMonth(addMonths(selectedMonth, -1)) : startOfMonth(addMonths(selectedMonth, 1)));
        }
    };

    // ========================================================
    // EXPORTAR PLANILHA DE ALOCAÇÃO (Excel)
    // ========================================================
    const handleExportAllocationSheet = () => {
        // 1. Determinar o período igual ao selecionado no painel
        let start = startOfMonth(selectedMonth);
        let end = endOfMonth(selectedMonth);

        if (viewMode === 'daily') {
            start = selectedMonth;
            end = selectedMonth;
        } else if (viewMode === '3months') {
            start = startOfMonth(addMonths(selectedMonth, -2));
            end = endOfMonth(selectedMonth);
        } else if (viewMode === '6months') {
            start = startOfMonth(addMonths(selectedMonth, -5));
            end = endOfMonth(selectedMonth);
        } else if (viewMode === '1year') {
            start = startOfMonth(addMonths(selectedMonth, -11));
            end = endOfMonth(selectedMonth);
        } else if (viewMode === 'custom') {
            try {
                const cs = parseISO(appliedStart);
                const ce = parseISO(appliedEnd);
                start = cs;
                end = ce > cs ? ce : cs;
            } catch { /* usa padrão */ }
        }

        const days = eachDayOfInterval({ start, end });

        // Helper: horas máximas do dia
        const getMaxHours = (date: Date): number => {
            const dow = date.getDay();
            if (dow === 0 || dow === 6) return 0;
            return dow === 5 ? 8 : 9;
        };

        // 2. Montar linhas da planilha
        const rows: (string | number)[][] = [];

        days.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dateFormatted = format(day, 'dd/MM/yyyy');
            const maxHours = getMaxHours(day);

            // Alocações e parciais do dia
            const dailyAllocs = allocations[dateKey] || {};
            const dailyPartials = partialAllocations[dateKey] || {};
            const dailyObs = observations[dateKey] || {};
            const dailyLinks = resourceLinks[dateKey] || {};
            // dailyLinks: { machineId: employeeId }
            // Inverter para: { employeeId: machineName }
            const employeeToMachine: { [empId: string]: string } = {};
            Object.entries(dailyLinks).forEach(([machineId, employeeId]) => {
                const machine = resources.find(r => r.id === machineId);
                if (machine) employeeToMachine[employeeId] = machine.name;
            });

            // Filtrar apenas funcionários ativos naquele dia
            const activeEmployees = resources.filter(r => {
                if (r.type !== 'employee') return false;
                if (r.isAdministrative) return false;
                if (r.dismissedAt && dateKey >= r.dismissedAt) return false;
                return true;
            });

            let addedAnyRowForDay = false;

            activeEmployees.forEach(employee => {
                // Verificar se tem parciais
                const partials = dailyPartials[employee.id];

                // Máquina vinculada via resourceLinks (preciso e direto)
                const linkedMachineName = employeeToMachine[employee.id] || '';

                // Função para achar máquina: primeiro tenta link direto, depois heurística por obra
                const findLinkedMachine = (worksiteId: string): string => {
                    // 1. Link direto tem prioridade
                    if (linkedMachineName) return linkedMachineName;
                    // 2. Heurística: única máquina na mesma obra
                    if (!worksiteId || worksiteId === 'pateo') return '';
                    const machinesInSameWorksite = resources.filter(r => {
                        if (r.type !== 'machine') return false;
                        if (r.dismissedAt && dateKey >= r.dismissedAt) return false;
                        const alloc = dailyAllocs[r.id];
                        if (alloc === worksiteId) return true;
                        const mPartials = dailyPartials[r.id];
                        if (mPartials && mPartials.some(p => p.worksiteId === worksiteId)) return true;
                        return false;
                    });
                    return machinesInSameWorksite.length === 1 ? machinesInSameWorksite[0].name : '';
                };

                if (partials && partials.length > 0) {
                    // MÚLTIPLAS LINHAS: uma por parcial
                    partials.forEach(partial => {
                        const wsId = partial.worksiteId;
                        const wsName = wsId === 'pateo' ? 'PÁTIO'
                            : worksites.find(w => w.id === wsId)?.name || wsId;
                        const obs = wsId === 'pateo' ? '' : (dailyObs[wsId] || '');
                        const machine = findLinkedMachine(wsId);

                        rows.push([
                            dateFormatted,
                            partial.hours,
                            employee.name,
                            employee.role || '',
                            machine,
                            wsName,
                            obs
                        ]);
                        addedAnyRowForDay = true;
                    });
                } else {
                    // LINHA Única: alocação simples
                    const wsId = dailyAllocs[employee.id] || 'pateo';
                    const wsName = wsId === 'pateo' ? 'PÁTIO'
                        : worksites.find(w => w.id === wsId)?.name || wsId;
                    const obs = wsId === 'pateo' ? '' : (dailyObs[wsId] || '');
                    const machine = findLinkedMachine(wsId);

                    rows.push([
                        dateFormatted,
                        maxHours > 0 ? maxHours : 0,
                        employee.name,
                        employee.role || '',
                        machine,
                        wsName,
                        obs
                    ]);
                    addedAnyRowForDay = true;
                }
            });

            // Linha em branco para separar os dias visualmente
            if (addedAnyRowForDay) {
                rows.push(['', '', '', '', '', '', '']);
            }
        });

        // 3. Montar o workbook Excel com estilo
        const headerRow = ['DATA', 'HORAS\nTRABALHADAS', 'NOME', 'FUNÇÃO', 'EQUIPAMENTO', 'OBRA', 'OBSERVAÇÃO'];

        const wsData = [headerRow, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Larguras de coluna
        ws['!cols'] = [
            { wch: 13 },  // DATA
            { wch: 10 },  // HORAS
            { wch: 32 },  // NOME
            { wch: 26 },  // FUNÇÃO
            { wch: 24 },  // EQUIPAMENTO
            { wch: 24 },  // OBRA
            { wch: 34 },  // OBSERVAÇÃO
        ];

        // Altura da linha do cabeçalho
        ws['!rows'] = [{ hpt: 36 }];

        // Estilo do cabeçalho (fundo amarelo, negrito, bordas)
        const headerStyle = {
            fill: { fgColor: { rgb: 'FFFF00' } },
            font: { bold: true, sz: 11 },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: '000000' } },
                bottom: { style: 'thin', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } },
            }
        };

        const dataStyle = {
            font: { sz: 10 },
            alignment: { vertical: 'center', wrapText: false },
            border: {
                top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                right: { style: 'thin', color: { rgb: 'CCCCCC' } },
            }
        };

        // Aplicar estilos célula por célula
        const totalRows = wsData.length;
        const totalCols = 7;
        const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

        for (let r = 0; r < totalRows; r++) {
            for (let c = 0; c < totalCols; c++) {
                const cellRef = colLetters[c] + (r + 1);
                if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
                ws[cellRef].s = r === 0 ? headerStyle : dataStyle;
            }
        }

        // Criar o workbook e salvar
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Alocação');

        const periodLabel = viewMode === 'monthly'
            ? format(selectedMonth, 'MMMM-yyyy', { locale: ptBR })
            : viewMode === 'daily'
            ? format(selectedMonth, 'dd-MM-yyyy')
            : `${format(start, 'dd-MM-yyyy')}_a_${format(end, 'dd-MM-yyyy')}`;

        XLSX.writeFile(wb, `Planilha_Alocacao_${periodLabel}.xlsx`);
    };
    // ========================================================

    return (
        <div className="dashboard-container" style={{ padding: '12px 16px', background: '#f8fafc', minHeight: '100vh', paddingBottom: '60px' }}>
            {/* Header com Filtros */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: 0 }}>Dashboard Analítico</h2>
                    <p style={{ color: '#64748b', margin: '2px 0 0 0', fontWeight: '600', fontSize: '11px' }}>
                        {viewMode === 'monthly' ? 'Visão Mensal Consolidada' : 'Visão Diária Detalhada'}
                    </p>
                </div>

                {/* Botão Exportar Planilha */}
                <button
                    onClick={handleExportAllocationSheet}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                        color: 'white',
                        fontWeight: '800',
                        fontSize: '11px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap'
                    }}
                    title="Exportar planilha de alocação do período selecionado (.xlsx)"
                    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                    📊 Exportar Planilha
                </button>


                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {/* Toggle Display Mode */}
                    <div style={{ background: 'white', padding: '2px', borderRadius: '8px', display: 'flex', gap: '2px', border: '1px solid #e2e8f0' }}>
                        <button
                            onClick={() => setViewMode('daily')}
                            style={{
                                padding: '5px 10px', borderRadius: '6px', border: 'none', fontWeight: '800', cursor: 'pointer',
                                background: viewMode === 'daily' ? '#e0f2fe' : 'transparent',
                                color: viewMode === 'daily' ? '#0284c7' : '#64748b',
                                fontSize: '11px'
                            }}
                        >
                            Diário
                        </button>
                        <button
                            onClick={() => setViewMode('monthly')}
                            style={{
                                padding: '5px 10px', borderRadius: '6px', border: 'none', fontWeight: '800', cursor: 'pointer',
                                background: viewMode === 'monthly' ? '#e0f2fe' : 'transparent',
                                color: viewMode === 'monthly' ? '#0284c7' : '#64748b',
                                fontSize: '11px'
                            }}
                        >
                            Mensal
                        </button>
                        <button
                            onClick={() => setViewMode('3months')}
                            style={{
                                padding: '5px 10px', borderRadius: '6px', border: 'none', fontWeight: '800', cursor: 'pointer',
                                background: viewMode === '3months' ? '#e0f2fe' : 'transparent',
                                color: viewMode === '3months' ? '#0284c7' : '#64748b',
                                fontSize: '11px'
                            }}
                        >
                            3 Meses
                        </button>
                        <button
                            onClick={() => setViewMode('6months')}
                            style={{
                                padding: '5px 10px', borderRadius: '6px', border: 'none', fontWeight: '800', cursor: 'pointer',
                                background: viewMode === '6months' ? '#e0f2fe' : 'transparent',
                                color: viewMode === '6months' ? '#0284c7' : '#64748b',
                                fontSize: '11px'
                            }}
                        >
                            6 Meses
                        </button>
                        <button
                            onClick={() => setViewMode('1year')}
                            style={{
                                padding: '5px 10px', borderRadius: '6px', border: 'none', fontWeight: '800', cursor: 'pointer',
                                background: viewMode === '1year' ? '#e0f2fe' : 'transparent',
                                color: viewMode === '1year' ? '#0284c7' : '#64748b',
                                fontSize: '11px'
                            }}
                        >
                            1 Ano
                        </button>
                        <button
                            onClick={() => setViewMode('custom')}
                            style={{
                                padding: '5px 10px', borderRadius: '6px', border: 'none', fontWeight: '800', cursor: 'pointer',
                                background: viewMode === 'custom' ? '#f3e8ff' : 'transparent',
                                color: viewMode === 'custom' ? '#7c3aed' : '#64748b',
                                fontSize: '11px'
                            }}
                        >
                            📅 Personalizado
                        </button>
                    </div>

                    {/* Painel de datas personalizadas */}
                    {viewMode === 'custom' && (
                        <div style={{
                            display: 'flex', gap: '6px', alignItems: 'center',
                            background: 'white', padding: '4px 8px', borderRadius: '8px',
                            border: `2px solid ${pendingCustom ? '#f59e0b' : '#7c3aed'}`,
                            boxShadow: `0 2px 8px ${pendingCustom ? 'rgba(245,158,11,0.2)' : 'rgba(124,58,237,0.15)'}`
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <label style={{ fontSize: '8px', fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase' }}>De</label>
                                <input
                                    type="date"
                                    value={customStart}
                                    onChange={e => { setCustomStart(e.target.value); setPendingCustom(true); }}
                                    style={{
                                        border: '1px solid #e2e8f0', borderRadius: '6px',
                                        padding: '2px 6px', fontSize: '11px', fontWeight: '700',
                                        color: '#1e293b', outline: 'none', cursor: 'pointer'
                                    }}
                                />
                            </div>
                            <div style={{ color: '#94a3b8', fontWeight: '800', fontSize: '12px', marginTop: '10px' }}>→</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <label style={{ fontSize: '8px', fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase' }}>Até</label>
                                <input
                                    type="date"
                                    value={customEnd}
                                    onChange={e => { setCustomEnd(e.target.value); setPendingCustom(true); }}
                                    style={{
                                        border: '1px solid #e2e8f0', borderRadius: '6px',
                                        padding: '2px 6px', fontSize: '11px', fontWeight: '700',
                                        color: '#1e293b', outline: 'none', cursor: 'pointer'
                                    }}
                                />
                            </div>
                            {/* Botão Aplicar */}
                            <button
                                onClick={() => {
                                    setAppliedStart(customStart);
                                    setAppliedEnd(customEnd);
                                    setPendingCustom(false);
                                }}
                                style={{
                                    marginTop: '10px',
                                    padding: '3px 10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: '800',
                                    fontSize: '11px',
                                    background: pendingCustom
                                        ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                                        : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                                    color: 'white',
                                    boxShadow: pendingCustom
                                        ? '0 2px 8px rgba(245,158,11,0.4)'
                                        : '0 2px 8px rgba(124,58,237,0.3)',
                                    transition: 'all 0.2s ease',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {pendingCustom ? '⚡ Aplicar' : '✓ Aplicado'}
                            </button>
                        </div>
                    )}

                    {/* Navegação por setas (oculta em modo personalizado) */}
                    {viewMode !== 'custom' && (
                    <div style={{ display: 'flex', gap: '6px', background: 'white', padding: '3px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <button onClick={() => handleNavigation('prev')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', color: '#64748b' }}><ChevronLeft size={16} /></button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 8px', fontWeight: '800', color: '#1e293b', fontSize: '11px' }}>
                            <Calendar size={14} color="#3b82f6" />
                            {viewMode === 'daily' 
                                ? format(selectedMonth, "dd 'de' MMMM", { locale: ptBR }).toUpperCase()
                                : viewMode === 'monthly'
                                ? format(selectedMonth, 'MMMM yyyy', { locale: ptBR }).toUpperCase()
                                : `${format(addMonths(selectedMonth, viewMode === '3months' ? -2 : viewMode === '6months' ? -5 : -11), 'MMM/yy', { locale: ptBR })} ➔ ${format(selectedMonth, 'MMM/yy', { locale: ptBR })}`.toUpperCase()
                            }
                        </div>
                        <button onClick={() => handleNavigation('next')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', color: '#64748b' }}><ChevronRight size={16} /></button>
                    </div>
                    )}
                </div>
            </div>

            {/* Grid de Cards Principais */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>

                {/* 1. Custo TOTAL (Soma Geral) */}
                <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '12px 16px', borderRadius: '14px', color: 'white', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px', borderRadius: '8px' }}><TrendingUp size={18} /></div>
                        <ArrowUpRight size={16} color="#4ade80" />
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Custo Líquido Total</div>
                    <div style={{ fontSize: '18px', fontWeight: '900', margin: '4px 0', letterSpacing: '-0.02em' }}>R$ {stats.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '700' }}>Real + Estimado</div>
                </div>

                {/* 2. Custo REAL (Finalizado) */}
                <div style={{ background: 'white', padding: '12px 16px', borderRadius: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ background: '#dcfce7', padding: '6px', borderRadius: '8px' }}><CheckCircle2 size={18} color="#166534" /></div>
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Custo Líquido Real</div>
                    <div style={{ fontSize: '18px', fontWeight: '900', margin: '4px 0', color: '#166534' }}>R$ {stats.totalRealCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: '9px', color: '#166534', fontWeight: '700' }}>Alocações Finalizadas</div>
                </div>

                {/* 3. Custo ESTIMADO (Planejamento) */}
                <div style={{ background: 'white', padding: '12px 16px', borderRadius: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ background: '#eff6ff', padding: '6px', borderRadius: '8px' }}><Calendar size={18} color="#3b82f6" /></div>
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Custo Líquido Estimado</div>
                    <div style={{ fontSize: '18px', fontWeight: '900', margin: '4px 0', color: '#3b82f6' }}>R$ {stats.totalEstimatedCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: '9px', color: '#3b82f6', fontWeight: '700' }}>Alocações em Planejamento</div>
                </div>
            </div>

            {/* Linha Secundária: Diesel e Chuva */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                {/* Custo Diesel */}
                <div style={{ background: 'white', padding: '12px 16px', borderRadius: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ background: '#ecfdf5', padding: '6px', borderRadius: '8px' }}><Droplet size={18} color="#10b981" /></div>
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Consumo de Diesel</div>
                    <div style={{ fontSize: '18px', fontWeight: '900', margin: '4px 0', color: '#0f172a' }}>R$ {stats.totalFuelCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: '9px', color: '#10b981', fontWeight: '700' }}>Baseado na Cotação Diária</div>
                </div>

                {/* Custo Chuva */}
                <div style={{ background: 'white', padding: '12px 16px', borderRadius: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ background: '#eff6ff', padding: '6px', borderRadius: '8px' }}><Droplet size={18} color="#3b82f6" /></div>
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Custo Improd. Climática (Chuvas)</div>
                    <div style={{ fontSize: '18px', fontWeight: '900', margin: '4px 0', color: '#0f172a' }}>R$ {stats.totalRainCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
            </div>

            {/* Ranking e Gráfico Pizza */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                {/* Ranking de Custos (com Pátio) */}
                <div style={{ background: 'white', padding: '12px 16px', borderRadius: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ background: '#f0f9ff', padding: '5px', borderRadius: '6px', color: '#3b82f6' }}><Building2 size={16} /></div>
                        <h3 style={{ fontSize: '13px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Ranking de Custos</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                        {stats.rankingData.map((item, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: '8px', background: index === 0 ? '#f8fafc' : 'transparent', border: index === 0 ? '1px solid #e2e8f0' : 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : index === 2 ? '#b45309' : '#e2e8f0', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '800' }}>
                                        {index + 1}
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#334155' }}>{item.name}</span>
                                </div>
                                <span style={{ fontSize: '11px', fontWeight: '800', color: '#0f172a' }}>
                                    R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        ))}
                        {stats.rankingData.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>Nenhum custo registrado no período.</div>
                        )}
                    </div>
                </div>

                {/* Gráfico de Barras de Custos por Obra */}
                <div style={{ background: 'white', padding: '12px 16px', borderRadius: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: '900', color: '#1e293b', marginBottom: '12px' }}>Custos por Obra</h3>
                    <div style={{ height: '320px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.pieData} margin={{ top: 10, right: 10, left: 15, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 8, fill: '#64748b' }}
                                    interval={0}
                                    angle={-20}
                                    textAnchor="end"
                                    height={50}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 8, fill: '#64748b' }}
                                    tickFormatter={(val) => `R$ ${Number(val).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                                />
                                <RechartsTooltip 
                                    formatter={(value: any) => `R$ ${Number(value).toLocaleString('pt-BR')}`}
                                    labelStyle={{ fontWeight: 'bold', fontSize: '10px' }}
                                    contentStyle={{ fontSize: '10px' }}
                                />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {stats.pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Novo Gráfico: Evolução por Obra (MODO MENSAL E ACUMULADOS) */}
            {viewMode !== 'daily' && (
                <div style={{ background: 'white', padding: '16px', borderRadius: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', minHeight: '300px', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b', marginBottom: '12px' }}>Evolução de Custos por Obra</h3>
                    <div style={{ height: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.worksiteDailyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                <RechartsTooltip formatter={(value: any) => `R$ ${Number(value).toLocaleString('pt-BR')}`} itemSorter={(item) => -(Number(item.value) || 0)} />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                                {worksites
                                    .filter(w => stats.rankingData.some(r => r.name === w.name))
                                    .map((w, idx) => {
                                        const color = stats.rankingData.find(r => r.name === w.name)?.color || '#94a3b8';
                                        return (
                                            <Line
                                                key={w.id}
                                                type="monotone"
                                                dataKey={w.name}
                                                stroke={color}
                                                strokeWidth={2}
                                                dot={false}
                                                name={`${w.name} (Diário)`}
                                            />
                                        );
                                    })}

                                {/* Linha do Pátio Opcional */}
                                {stats.rankingData.some(r => r.name === 'Pátio (Ociosidade)') && (
                                    <Line type="monotone" dataKey="Pátio" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Pátio (Diário)" />
                                )}
                                <Line type="monotone" dataKey="Chuva" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Chuva (Diário)" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Novo Gráfico: Evolução de Custos Acumulados */}
            {viewMode !== 'daily' && (
                <div style={{ background: 'white', padding: '16px', borderRadius: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', minHeight: '300px', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b', marginBottom: '4px' }}>Evolução de Custos Acumulados por Obra</h3>
                    <p style={{ fontSize: '10px', color: '#64748b', marginBottom: '12px' }}>Mostra o crescimento do custo somado a cada dia do período selecionado.</p>
                    <div style={{ height: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.worksiteCumulativeData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                <RechartsTooltip formatter={(value: any) => `R$ ${Number(value).toLocaleString('pt-BR')}`} itemSorter={(item) => -(Number(item.value) || 0)} />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                                {worksites
                                    .filter(w => stats.rankingData.some(r => r.name === w.name))
                                    .map((w, idx) => {
                                        const color = stats.rankingData.find(r => r.name === w.name)?.color || '#94a3b8';
                                        return (
                                            <Line
                                                key={`cumul-${w.id}`}
                                                type="monotone"
                                                dataKey={w.name}
                                                stroke={color}
                                                strokeWidth={2}
                                                dot={false}
                                                name={`${w.name} (Acumulado)`}
                                            />
                                        );
                                    })}
                                {/* Linha do Pátio Opcional */}
                                {stats.rankingData.some(r => r.name === 'Pátio (Ociosidade)') && (
                                    <Line type="monotone" dataKey="Pátio" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Pátio (Acumulado)" />
                                )}
                                <Line type="monotone" dataKey="Chuva" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Chuva (Acumulado)" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}


            {/* Alertas (Apenas Ociosidade, Manutenção removido) */}
            <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {/* Ociosidade */}
                <div style={{ background: '#fff1f2', padding: '12px 16px', borderRadius: '14px', border: '1px solid #fecdd3' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ background: '#fecdd3', padding: '5px', borderRadius: '6px', color: '#be123c' }}><AlertTriangle size={16} /></div>
                        <h3 style={{ fontSize: '13px', fontWeight: '900', color: '#881337', margin: 0 }}>Recursos com Maior Ociosidade</h3>
                    </div>
                    <div style={{ marginBottom: '8px', fontSize: '10px', color: '#9f1239', opacity: 0.8 }}>
                        * Contabiliza apenas dias úteis com status "Alocação Final". Recursos em manutenção não contam.
                    </div>
                    {stats.idleResources.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                            {stats.idleResources.map((res, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#9f1239' }}>{res.name}</span>
                                        <span style={{ fontSize: '9px', padding: '2px 4px', borderRadius: '4px', background: res.type === 'machine' ? '#fcd34d' : '#bae6fd', color: res.type === 'machine' ? '#92400e' : '#0369a1', fontWeight: '800' }}>
                                            {res.type === 'machine' ? 'MQ' : 'FUNC'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#be123c' }}>{res.days} dias parado</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', color: '#9f1239', padding: '20px', fontSize: '14px' }}>Sem alertas de ociosidade!</div>
                    )}
                </div>
            </div>

            {/* Histórico de Manutenção Consolidado */}
            <div style={{ background: 'white', padding: '12px 16px', borderRadius: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', marginTop: '16px', gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ background: '#fff7ed', padding: '5px', borderRadius: '8px' }}>
                        <Tractor size={16} color="#ea580c" />
                    </div>
                    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', margin: 0 }}>Histórico de Manutenção e Indisponibilidade</h3>
                </div>

                <div style={{ overflowX: 'auto', maxHeight: viewMode === 'monthly' ? '400px' : '260px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '10px', fontWeight: 700, color: '#64748b' }}>MÁQUINA</th>
                                <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: '10px', fontWeight: 700, color: '#64748b' }}>PERÍODO INDISPONÍVEL</th>
                                <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: '10px', fontWeight: 700, color: '#64748b' }}>CUSTO INDISP.</th>
                                <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: '10px', fontWeight: 700, color: '#64748b' }}>IMPACTO (DIAS ÚTEIS)</th>
                                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '10px', fontWeight: 700, color: '#64748b' }}>MOTIVO REGISTRADO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.maintenanceIntervals.map((entry, idx) => {
                                const res = resources.find(r => r.id === entry.resourceId);
                                if (!res) return null;
                                return (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                                        <td style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {res.photo ? (
                                                <img src={res.photo} alt={res.name} style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>🚜</div>
                                            )}
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>{res.name}</div>
                                        </td>
                                        <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
                                            {format(parseISO(entry.start), 'dd/MM')} até {format(parseISO(entry.end), 'dd/MM')}
                                        </td>
                                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                            <span style={{
                                                background: '#fff7ed',
                                                color: '#c2410c',
                                                padding: '2px 6px',
                                                borderRadius: '6px',
                                                fontSize: '10px',
                                                fontWeight: '800',
                                                border: '1px solid #ffedd5'
                                            }}>
                                                R$ {entry.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                            <span style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: '800' }}>
                                                {entry.days} dias alocados
                                            </span>
                                        </td>
                                        <td style={{ padding: '6px 8px', fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                                            {entry.reason}
                                        </td>
                                    </tr>
                                );
                            })}
                            {stats.maintenanceIntervals.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>
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
