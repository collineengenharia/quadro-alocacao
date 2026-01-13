export interface Resource {
    id: string;
    name: string;
    type: 'employee' | 'machine';
    role: string;
    photo: string;
    costPerDay: number;
    ignoreCost?: boolean;
    isAdministrative?: boolean;
}

export interface Worksite {
    id: string;
    name: string;
    color: string;
    visible?: boolean;
}

export interface AllocationData {
    [dateKey: string]: { [resourceId: string]: string };
}

export interface AllocationMetadata {
    [dateKey: string]: {
        isFinalAllocation?: boolean;
        observations?: string;
    };
}

export interface OvertimeEntry {
    hours: number;
    multiplier: 1.5 | 2.0; // 1.5 para 50%, 2.0 para 100%
}

export interface OvertimeData {
    [dateKey: string]: { [resourceId: string]: OvertimeEntry };
}
export interface ResourceLinks {
    [dateKey: string]: { [machineId: string]: string }; // machineId -> operatorId
}

export interface MaintenanceEntry {
    inMaintenance: boolean;
    reason?: string;
}

export interface MaintenanceData {
    [dateKey: string]: { [resourceId: string]: MaintenanceEntry };
}

export interface FuelQuoteData {
    [dateKey: string]: number;
}

export interface PartialAllocation {
    resourceId: string;
    worksiteId: string;
    hours: number;
    earlyDismissal?: boolean;
    maintenanceAfter?: boolean;
}

export interface PartialAllocationsData {
    [dateKey: string]: { [resourceId: string]: PartialAllocation[] };
}

export interface FuelEntry {
    resourceId: string;
    date: string;
    fuelLiters: number;
    oilLiters: number;
    notes?: string;
}

export type FuelData = { [date: string]: { [resourceId: string]: FuelEntry } };
