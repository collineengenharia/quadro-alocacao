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

export interface MaintenanceData {
    [dateKey: string]: { [resourceId: string]: boolean };
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
