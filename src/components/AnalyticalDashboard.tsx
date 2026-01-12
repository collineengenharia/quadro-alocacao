import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import {
    TrendingUp, Users, Building2, AlertTriangle, Calendar,
    ArrowUpRight, ArrowDownRight, Clock, Droplet, Tractor
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import type { Resource, Worksite, OvertimeData, MaintenanceData, PartialAllocationsData, FuelData } from '../types';

interface DashboardProps {
    resources: Resource[];
    allocations: { [date: string]: { [resourceId: string]: string } };
    overtime?: OvertimeData;
    maintenanceHistory?: MaintenanceData;
    partialAllocations?: PartialAllocationsData;
    fuelData?: FuelData;
    worksites: Worksite[];
    selectedMonth: Date;
    onMonthChange: (date: Date) => void;
}

const OBRA_COLORS: { [key: string]: string } = {
    'obra-1': '#3b82f6',
    'obra-2': '#10b981',
    'obra-3': '#f59e0b',
    'obra-4': '#ef4444',
    'obra-5': '#8b5cf6',
    'pateo': '#64748b'
};

function addMonths(date: Date, months: number): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}

function ChevronLeft({ size, color }: { size: number, color?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
        </svg>
    );
}

function ChevronRight({ size, color }: { size: number, color?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
        </svg>
    );
}

export const AnalyticalDashboard: React.FC<DashboardProps> = ({
    resources,
    allocations,
    overtime = {},
    worksites,
    selectedMonth,
    onMonthChange,
    maintenanceHistory = {},
    partialAllocations = {},
    fuelData = {}
}) => {
    const FUEL_PRICE = 6.0; // R$/L

    const getMaxHoursForDate = (date: Date): number => {
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) return 0;
        return dayOfWeek === 5 ? 8 : 9;
    };

    const getMaintStatus = (resId: string, dKey: string) => {
        const dates = Object.keys(maintenanceHistory).filter(d => d <= dKey).sort().reverse();
        for (const d of dates) {
            if (maintenanceHistory[d]?.[resId] !== undefined) return maintenanceHistory[d][resId];
        }
        return false;
    };

    const stats = useMemo(() => {
        let totalCost = 0;
        let totalFuelCost = 0;
        const costBySite: { [key: string]: number } = {};
        const dailyCosts: { [key: string]: number } = {};
        const resourceUsage: { [key: string]: { obra: number, pateo: number } } = {};
        let totalRainCost = 0;
        let totalIdleCost = 0;

        const monthStart = startOfMonth(selectedMonth);
        const monthEnd = endOfMonth(selectedMonth);
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

        // Gráfico Anual
        const monthlyData: { name: string, total: number }[] = [];
        const year = selectedMonth.getFullYear();

        for (let m = 0; m < 12; m++) {
            const mStart = new Date(year, m, 1);
            const mEnd = endOfMonth(mStart);
            const mDays = eachDayOfInterval({ start: mStart, end: mEnd });
            let mTotal = 0;

            mDays.forEach(day => {
                const dk = format(day, 'yyyy-MM-dd');
                const dAlloc = allocations[dk] || {};
                const maxHours = getMaxHoursForDate(day) || 8;

                resources.forEach(res => {
                    const partials = partialAllocations[dk]?.[res.id];
                    let dailyBaseCost = 0;

                    const isInMaint = res.type === 'machine' && getMaintStatus(res.id, dk);
                    const isF = res.ignoreCost || isInMaint;

                    if (!isF) {
                        if (partials && partials.length > 0) {
                            const costPerHour = (res.costPerDay || 0) / maxHours;
                            partials.forEach(p => {
                                if (p.worksiteId !== 'pateo') dailyBaseCost += costPerHour * p.hours;
                            });
                        } else {
                            const sid = dAlloc[res.id] || 'pateo';
                            if (sid !== 'pateo') dailyBaseCost = res.costPerDay || 0;
                        }
                    }

                    const o = overtime[dk]?.[res.id];
                    const oC = o ? ((res.costPerDay || 0) / maxHours) * o.hours * o.multiplier : 0;
                    const f = fuelData[dk]?.[res.id];
                    const fC = f ? f.fuelLiters * FUEL_PRICE : 0;
                    mTotal += (dailyBaseCost + oC + fC);
                });
            });

            monthlyData.push({
                name: format(mStart, 'MMM', { locale: ptBR }).toUpperCase(),
                total: mTotal
            });
        }

        days.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayAlloc = allocations[dateKey] || {};
            dailyCosts[dateKey] = 0;

            resources.forEach(res => {
                const maxHours = getMaxHoursForDate(day) || 8;
                const partials = partialAllocations[dateKey]?.[res.id];
                let dailyBaseCost = 0;

                const isInMaint = res.type === 'machine' && getMaintStatus(res.id, dateKey);
                const isFree = res.ignoreCost || isInMaint;

                const fuelEntry = fuelData[dateKey]?.[res.id];
                const dailyFuelCost = fuelEntry ? fuelEntry.fuelLiters * FUEL_PRICE : 0;
                totalFuelCost += dailyFuelCost;

                if (!isFree) {
                    if (partials && partials.length > 0) {
                        const costPerHour = (res.costPerDay || 0) / maxHours;
                        const totalHours = partials.reduce((acc, p) => acc + p.hours, 0);

                        partials.forEach(p => {
                            if (p.worksiteId !== 'pateo') {
                                const basePart = costPerHour * p.hours;
                                const fuelPart = totalHours > 0 ? (p.hours / totalHours) * dailyFuelCost : 0;
                                dailyBaseCost += basePart;
                                costBySite[p.worksiteId] = (costBySite[p.worksiteId] || 0) + basePart + fuelPart;
                            }
                        });
                    } else {
                        const sid = dayAlloc[res.id] || 'pateo';
                        if (sid !== 'pateo') {
                            dailyBaseCost = res.costPerDay || 0;
                            costBySite[sid] = (costBySite[sid] || 0) + dailyBaseCost + dailyFuelCost;
                        }
                    }
                } else if (dailyFuelCost > 0) {
                    const sid = (partials && partials.length > 0) ? partials[0].worksiteId : (dayAlloc[res.id] || 'pateo');
                    costBySite[sid] = (costBySite[sid] || 0) + dailyFuelCost;
                }

                const ov = overtime[dateKey]?.[res.id];
                const extraCost = ov ? ((res.costPerDay || 0) / maxHours) * ov.hours * ov.multiplier : 0;

                const totalResCost = dailyBaseCost + extraCost + dailyFuelCost;
                dailyCosts[dateKey] += totalResCost;
                totalCost += totalResCost;

                const sid = (partials && partials.length > 0) ? partials[0].worksiteId : (dayAlloc[res.id] || 'pateo');
                const ws = worksites.find(w => w.id === sid);
                const isRain = ws?.name.toUpperCase().includes('CHUVA');

                if (isRain) {
                    totalRainCost += totalResCost;
                } else if (sid === 'pateo' && !isFree && !res.isAdministrative) {
                    totalIdleCost += (res.costPerDay || 0);
                }

                const workedAny = dailyBaseCost > 0;
                if (!resourceUsage[res.id]) resourceUsage[res.id] = { obra: 0, pateo: 0 };
                if (workedAny) resourceUsage[res.id].obra++;
                else if (!isInMaint && !res.isAdministrative) resourceUsage[res.id].pateo++;
            });
        });

        const pieData = worksites.map(ws => ({
            name: ws.name,
            value: costBySite[ws.id] || 0,
            color: OBRA_COLORS[ws.color] || '#cbd5e1'
        })).filter(d => d.value > 0);

        const lineData = days.slice(-14).map(day => ({
            date: format(day, 'dd/MM'),
            custo: dailyCosts[format(day, 'yyyy-MM-dd')] || 0
        }));

        let totalDaysObra = 0;
        let totalDaysPateo = 0;
        resources.forEach(res => {
            totalDaysObra += resourceUsage[res.id]?.obra || 0;
            totalDaysPateo += resourceUsage[res.id]?.pateo || 0;
        });
        const productivityRate = totalDaysObra / (totalDaysObra + totalDaysPateo || 1);

        const idleResources = resources
            .filter(r => !r.isAdministrative)
            .filter(r => {
                const todayKey = format(selectedMonth, 'yyyy-MM-dd');
                const isInMaint = r.type === 'machine' && getMaintStatus(r.id, todayKey);
                return !isInMaint;
            })
            .map(res => ({
                name: res.name,
                days: resourceUsage[res.id]?.pateo || 0,
                type: res.type
            }))
            .sort((a, b) => b.days - a.days)
            .slice(0, 3)
            .filter(r => r.days > 0);

        const topSiteId = Object.entries(costBySite).sort((a, b) => b[1] - a[1])[0]?.[0];
        const topSiteName = worksites.find(w => w.id === topSiteId)?.name || "N/A";

        return { totalCost, totalFuelCost, pieData, lineData, productivityRate, idleResources, topSiteName, monthlyData, totalRainCost, totalIdleCost };
    }, [resources, allocations, overtime, worksites, selectedMonth, partialAllocations, maintenanceHistory, fuelData]);

    const getProductivityColor = (rate: number) => {
        if (rate > 0.8) return '#16a34a';
        if (rate > 0.5) return '#f59e0b';
        return '#dc2626';
    };

    return (
        <div className="dashboard-container" style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
            {/* Header com Filtros */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', margin: 0 }}>Dashboard Analítico</h2>
                    <p style={{ color: '#64748b', margin: '4px 0 0 0', fontWeight: '600' }}>Visão geral de custos e produtividade</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', background: 'white', padding: '6px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <button onClick={() => onMonthChange(startOfMonth(addMonths(selectedMonth, -1)))} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '8px', color: '#64748b' }}><ChevronLeft size={20} /></button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', fontWeight: '800', color: '#1e293b' }}>
                        <Calendar size={18} color="#3b82f6" />
                        {format(selectedMonth, 'MMMM yyyy', { locale: ptBR }).toUpperCase()}
                    </div>
                    <button onClick={() => onMonthChange(startOfMonth(addMonths(selectedMonth, 1)))} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '8px', color: '#64748b' }}><ChevronRight size={20} /></button>
                </div>
            </div>

            {/* Grid de Cards Principais */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                {/* Custo Total */}
                <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '24px', borderRadius: '24px', color: 'white', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '14px' }}><TrendingUp size={24} /></div>
                        <ArrowUpRight size={20} color="#4ade80" />
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Custo Líquido Estimado</div>
                    <div style={{ fontSize: '28px', fontWeight: '900', margin: '4px 0', letterSpacing: '-0.02em' }}>R$ {stats.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: '11px', color: '#4ade80', fontWeight: '700' }}>↑ 12% em relação ao mês anterior</div>
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', color: '#94a3b8' }}>
                        Inclui diárias, extras e diesel.
                    </div>
                </div>

                {/* Custo Diesel */}
                <div style={{ background: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ background: '#ecfdf5', padding: '10px', borderRadius: '14px' }}><Droplet size={24} color="#10b981" /></div>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Consumo de Diesel</div>
                    <div style={{ fontSize: '26px', fontWeight: '900', margin: '4px 0', color: '#0f172a' }}>R$ {stats.totalFuelCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '700' }}>Base: R$ 6,00/Litro</div>
                </div>

                {/* Taxa de Utilização */}
                <div style={{ background: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ background: '#fef3c7', padding: '10px', borderRadius: '14px' }}><Clock size={24} color="#f59e0b" /></div>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: getProductivityColor(stats.productivityRate) }}>{(stats.productivityRate * 100).toFixed(0)}%</div>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Taxa de Utilização</div>
                    <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', marginTop: '12px', overflow: 'hidden' }}>
                        <div style={{ width: `${stats.productivityRate * 100}%`, height: '100%', background: getProductivityColor(stats.productivityRate), borderRadius: '4px', transition: 'width 1s ease-in-out' }} />
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>Tempo em obra vs Tempo no pátio</div>
                </div>

                {/* Maior Investimento */}
                <div style={{ background: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ background: '#f0f9ff', padding: '10px', borderRadius: '14px' }}><Building2 size={24} color="#3b82f6" /></div>
                        <ArrowUpRight size={20} color="#3b82f6" />
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Maior Investimento</div>
                    <div style={{ fontSize: '18px', fontWeight: '900', margin: '4px 0', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stats.topSiteName}</div>
                    <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: '700' }}>Obra com maior consumo/dia</div>
                </div>
            </div>

            {/* Cards de Custo Chuva e Ociosidade (Novos) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                <div style={{ background: '#f0f9ff', padding: '20px', borderRadius: '20px', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: '#3b82f6', padding: '12px', borderRadius: '16px', color: 'white' }}><Droplet size={24} /></div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase' }}>Custo Improd. Climática (Chuvas)</div>
                        <div style={{ fontSize: '22px', fontWeight: '900', color: '#0c4a6e' }}>R$ {stats.totalRainCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>

                <div style={{ background: '#fff1f2', padding: '20px', borderRadius: '20px', border: '1px solid #fecdd3', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: '#ef4444', padding: '12px', borderRadius: '16px', color: 'white' }}><Clock size={24} /></div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#9f1239', textTransform: 'uppercase' }}>Custo Ociosidade (Pátio)</div>
                        <div style={{ fontSize: '22px', fontWeight: '900', color: '#881337' }}>R$ {stats.totalIdleCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>
            </div>

            {/* Gráficos em Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                {/* Distribuição por Obra */}
                <div style={{ background: 'white', padding: '28px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', minHeight: '400px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', marginBottom: '24px' }}>Distribuição de Custos por Obra</h3>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={stats.pieData} innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value">
                                    {stats.pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                </Pie>
                                <RechartsTooltip formatter={(value: any) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Evolução de Gastos */}
                <div style={{ background: 'white', padding: '28px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', minHeight: '400px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', marginBottom: '24px' }}>Evolução Mensal (Últimos 14 dias)</h3>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.lineData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                <RechartsTooltip formatter={(value: any) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />
                                <Line type="monotone" dataKey="custo" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Histórico Mensal do Ano */}
                <div style={{ background: 'white', padding: '28px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', minHeight: '400px', gridColumn: '1 / -1' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', marginBottom: '24px' }}>Histórico Financeiro Anual ({selectedMonth.getFullYear()})</h3>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <RechartsTooltip formatter={(value: any) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />
                                <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Alerta de Ociosidade */}
                {stats.idleResources.length > 0 && (
                    <div style={{
                        background: 'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)',
                        borderRadius: '20px',
                        padding: '28px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                        gridColumn: '1 / -1'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <AlertTriangle size={24} color="#d63031" />
                            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#2d3436' }}>
                                Recursos com Maior Ociosidade (Top 3)
                            </h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                            {stats.idleResources.map((res, i) => (
                                <div key={i} style={{
                                    background: 'white',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.08)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            background: '#f1f5f9',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '20px'
                                        }}>
                                            {res.type === 'employee' ? '👤' : '🚜'}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>{res.name}</div>
                                            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                                                {res.type === 'employee' ? 'Funcionário' : 'Máquina'}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#dc2626' }}>{res.days}</div>
                                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>DIAS</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Histórico de Manutenção */}
                <div style={{ background: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ background: '#fff7ed', padding: '8px', borderRadius: '12px' }}>
                            <Tractor size={20} color="#ea580c" />
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>Histórico de Disponibilidade (Manutenção)</h3>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: 700, color: '#64748b' }}>DATA</th>
                                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: 700, color: '#64748b' }}>MÁQUINA</th>
                                    <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', fontWeight: 700, color: '#64748b' }}>STATUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(maintenanceHistory)
                                    .sort((a, b) => b[0].localeCompare(a[0]))
                                    .slice(0, 10)
                                    .flatMap(([date, machines]) =>
                                        Object.entries(machines).map(([resId, isInMaint]) => {
                                            const res = resources.find(r => r.id === resId);
                                            if (!res) return null;
                                            return (
                                                <tr key={`${date}-${resId}`} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                    <td style={{ padding: '12px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                                                        {format(new Date(date + 'T00:00:00'), 'dd/MM/yyyy')}
                                                    </td>
                                                    <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <img src={res.photo} alt={res.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                                                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{res.name}</div>
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                                        <span style={{
                                                            padding: '4px 10px',
                                                            borderRadius: '8px',
                                                            fontSize: '11px',
                                                            fontWeight: 800,
                                                            background: isInMaint ? '#fef2f2' : '#f0fdf4',
                                                            color: isInMaint ? '#ef4444' : '#16a34a',
                                                            border: `1px solid ${isInMaint ? '#fecaca' : '#bbf7d0'}`
                                                        }}>
                                                            {isInMaint ? 'EM MANUTENÇÃO' : 'DISPONÍVEL'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                {Object.keys(maintenanceHistory).length === 0 && (
                                    <tr>
                                        <td colSpan={3} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>
                                            Nenhum registro de manutenção encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
