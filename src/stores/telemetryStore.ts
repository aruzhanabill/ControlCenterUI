import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type SignalType =
  | "oxtank_1_psi"
  | "oxtank_2_psi"
  | "copv_1_psi"
  | "copv_2_psi"
  | "pilot_pres_psi"
  | "qd_pres_psi"
  | "injector_1_psi"
  | "injector_2_psi"
  | "upper_cc_psi"
  | "gn2_internal_temp_c"
  | "gn2_external_temp_c"
  | "lox_upper_temp_c"
  | "lox_lower_temp_c"
  | "load_cell_1_lbs"
  | "load_cell_2_lbs"
  | "total_load_lbs"
  | "altitude_ft"
  | "acceleration_g"
  | "total_relay_current_ma"
  | "gn2_drain_current_ma"
  | "gn2_fill_current_ma"
  | "igniter_current_ma"
  | "cap_fill_actual"
  | "cap_fill_base"
  | "cap_fill_board_temp_c";

export const SIGNAL_METADATA: Record<
  SignalType,
  { label: string; unit: string; color: string }
> = {
  copv_1_psi: { label: "COPV 1", unit: "PSI", color: "#8338ec" },
  copv_2_psi: { label: "COPV 2", unit: "PSI", color: "#8338ec" },

  oxtank_1_psi: { label: "Oxtank 1", unit: "PSI", color: "#00d4ff" },
  oxtank_2_psi: { label: "Oxtank 2", unit: "PSI", color: "#00d4ff" },

  pilot_pres_psi: { label: "Pilot Pressure", unit: "PSI", color: "#7209b7" },
  qd_pres_psi: { label: "QD Pressure", unit: "PSI", color: "#560bad" },

  injector_1_psi: { label: "Injector 1", unit: "PSI", color: "#fb5607" },
  injector_2_psi: { label: "Injector 2", unit: "PSI", color: "#ffbe0b" },
  upper_cc_psi: { label: "Upper CC", unit: "PSI", color: "#ff006e" },

  gn2_internal_temp_c: { label: "GN2 Internal", unit: "°C", color: "#06ffa5" },
  gn2_external_temp_c: { label: "GN2 External", unit: "°C", color: "#1ce3ff" },
  lox_upper_temp_c: { label: "LOX Upper", unit: "°C", color: "#00f5ff" },
  lox_lower_temp_c: { label: "LOX Lower", unit: "°C", color: "#4cc9f0" },
  cap_fill_board_temp_c: { label: "Board Temp", unit: "°C", color: "#fb923c" },

  load_cell_1_lbs: { label: "Load Cell 1", unit: "lbs", color: "#ff9e00" },
  load_cell_2_lbs: { label: "Load Cell 2", unit: "lbs", color: "#ff6d00" },
  total_load_lbs: { label: "Total Load", unit: "lbs", color: "#ff3d00" },

  altitude_ft: { label: "Altitude", unit: "ft", color: "#69db7c" },
  acceleration_g: { label: "Acceleration", unit: "g", color: "#ffd43b" },

  total_relay_current_ma: {
    label: "Total Relay Current",
    unit: "mA",
    color: "#ff006e",
  },
  gn2_drain_current_ma: {
    label: "GN2 Drain Current",
    unit: "mA",
    color: "#8338ec",
  },
  gn2_fill_current_ma: {
    label: "GN2 Fill Current",
    unit: "mA",
    color: "#3a86ff",
  },
  igniter_current_ma: {
    label: "Igniter Current",
    unit: "mA",
    color: "#ffbe0b",
  },

  cap_fill_actual: {
    label: "Cap Fill Actual",
    unit: "%",
    color: "#38bdf8",
  },
  cap_fill_base: {
    label: "Cap Base",
    unit: "pF",
    color: "#94a3b8",
  },
};

export interface Sample {
  timestamp: number; // microseconds
  value: number;
}

class SignalBuffer {
  private buffer: Sample[] = [];
  private maxSize = 100_000;

  append(sample: Sample) {
    this.buffer.push(sample);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  query(tstart: number, tend: number): Sample[] {
    return this.buffer.filter(
      (s) => s.timestamp >= tstart && s.timestamp <= tend,
    );
  }

  getLatest(): Sample | null {
    return this.buffer.length > 0 ? this.buffer[this.buffer.length - 1] : null;
  }

  getAll(): Sample[] {
    return this.buffer;
  }

  clear() {
    this.buffer = [];
  }
}

export interface PlotConfig {
  id: string;
  signal: SignalType;
  timeRange: number; // s
  paused: boolean;
}

interface TelemetryState {
  buffers: Map<SignalType, SignalBuffer>;
  plots: PlotConfig[];
  connected: boolean;

  appendSample: (signal: SignalType, sample: Sample) => void;
  addPlot: (signal: SignalType) => void;
  removePlot: (plotId: string) => void;
  updatePlotTimeRange: (plotId: string, timeRange: number) => void;
  togglePlotPause: (plotId: string) => void;
  setConnected: (connected: boolean) => void;

  getSamples: (signal: SignalType, tstart: number, tend: number) => Sample[];
  getLatestSample: (signal: SignalType) => Sample | null;
}

const initializeBuffers = () => {
  const signals: SignalType[] = [
    "oxtank_1_psi",
    "oxtank_2_psi",
    "copv_1_psi",
    "copv_2_psi",
    "pilot_pres_psi",
    "qd_pres_psi",
    "injector_1_psi",
    "injector_2_psi",
    "upper_cc_psi",
    "gn2_internal_temp_c",
    "gn2_external_temp_c",
    "lox_upper_temp_c",
    "lox_lower_temp_c",
    "cap_fill_board_temp_c",
    "load_cell_1_lbs",
    "load_cell_2_lbs",
    "total_load_lbs",
    "altitude_ft",
    "acceleration_g",
    "total_relay_current_ma",
    "gn2_drain_current_ma",
    "gn2_fill_current_ma",
    "igniter_current_ma",
    "cap_fill_actual",
    "cap_fill_base",
  ];

  const buffers = new Map<SignalType, SignalBuffer>();
  signals.forEach((signal) => {
    buffers.set(signal, new SignalBuffer());
  });

  return buffers;
};

export const useTelemetryStore = create<TelemetryState>()(
  subscribeWithSelector((set, get) => ({
    buffers: initializeBuffers(),
    plots: [],
    connected: false,

    appendSample: (signal, sample) => {
      const buffer = get().buffers.get(signal);
      if (!buffer) {
        console.warn(`Buffer not found for signal: ${signal}`);
        return;
      }
      buffer.append(sample);
      set({ buffers: new Map(get().buffers) });
    },

    addPlot: (signal) => {
      const newPlot: PlotConfig = {
        id: `${signal}-${Date.now()}`,
        signal,
        timeRange: 120,
        paused: false,
      };
      set({ plots: [...get().plots, newPlot] });
    },

    removePlot: (plotId) => {
      set({ plots: get().plots.filter((p) => p.id !== plotId) });
    },

    updatePlotTimeRange: (plotId, timeRange) => {
      set({
        plots: get().plots.map((p) =>
          p.id === plotId ? { ...p, timeRange } : p,
        ),
      });
    },

    togglePlotPause: (plotId) => {
      set({
        plots: get().plots.map((p) =>
          p.id === plotId ? { ...p, paused: !p.paused } : p,
        ),
      });
    },

    setConnected: (connected) => {
      set({ connected });
    },

    getSamples: (signal, tstart, tend) => {
      const buffer = get().buffers.get(signal);
      return buffer ? buffer.query(tstart, tend) : [];
    },

    getLatestSample: (signal) => {
      const buffer = get().buffers.get(signal);
      return buffer ? buffer.getLatest() : null;
    },
  })),
);
