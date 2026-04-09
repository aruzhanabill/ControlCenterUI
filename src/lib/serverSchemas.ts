import { z } from "zod";

export const DEVICES = {
  firingStation: "FiringStation",
  fsState: "FsState",
  fsLoxGn2Transducers: "FsLoxGn2Transducers",
  fsInjectorTransducers: "FsInjectorTransducers",
  fsThermocouples: "FsThermocouples",
  loadCell1: "LoadCell1",
  loadCell2: "LoadCell2",
  radioGround: "RadioGround",
  relayCurrentMonitor: "RelayCurrentMonitor",
  capFill: "CapFill",
} as const;

export const DEFAULT_SERVER = "https://csi-fs-pi-data-server.ngrok.io";

export const fsCommandSchema = z.enum([
  "STATE_CUSTOM",
  "STATE_ABORT",
  "STATE_STANDBY",
  "STATE_GN2_STANDBY",
  "STATE_GN2_FILL",
  "STATE_GN2_PULSE_FILL_A",
  "STATE_GN2_PULSE_FILL_B",
  "STATE_GN2_PULSE_FILL_C",
  "STATE_ENGINE_PRIME",
  "STATE_FIRE",
  "STATE_FIRE_MANUAL_PRESS_PILOT",
  "STATE_FIRE_MANUAL_DOME_PILOT_CLOSE",
  "STATE_FIRE_MANUAL_DOME_PILOT_OPEN",
  "STATE_FIRE_MANUAL_IGNITER",
  "STATE_FIRE_MANUAL_RUN",
  "EREG_CLOSED",
  "EREG_STAGE_1",
  "EREG_STAGE_2",
  "EREG_SET_GAINS",
  "RECALIBRATE_TRANSDUCERS",
  "RESTART",
]);

export type FsCommand = z.infer<typeof fsCommandSchema>;

const customFsCommandMessageSchema = z.object({
  command: z.literal("STATE_CUSTOM"),
  gn2_drain: z.boolean(),
  gn2_fill: z.boolean(),
  depress: z.boolean(),
  press_pilot: z.boolean(),
  run: z.boolean(),
  lox_fill: z.boolean(),
  lox_disconnect: z.boolean(),
  igniter: z.boolean(),
  ereg_power: z.boolean(),
});

const eregSetGainsMessageSchema = z.object({
  command: z.literal("EREG_SET_GAINS"),
  kp: z.number(),
  ki: z.number(),
  kd: z.number(),
});

const baseFsCommandMessageSchema = z.object({
  command: fsCommandSchema.exclude(["STATE_CUSTOM", "EREG_SET_GAINS"]),
});

export const fsCommandMessageSchema = z.discriminatedUnion("command", [
  customFsCommandMessageSchema,
  eregSetGainsMessageSchema,
  baseFsCommandMessageSchema,
]);

export type FsCommandMessage = z.infer<typeof fsCommandMessageSchema>;

export const fsStateSchema = z.enum([
  "CUSTOM",
  "ABORT",
  "STANDBY",
  "GN2_STANDBY",
  "GN2_FILL",
  "GN2_PULSE_FILL_A",
  "GN2_PULSE_FILL_B",
  "GN2_PULSE_FILL_C",
  "FIRE",
  "FIRE_MANUAL_PRESS_PILOT",
  "FIRE_MANUAL_DOME_PILOT_CLOSE",
  "FIRE_MANUAL_IGNITER",
  "FIRE_MANUAL_RUN",
]);

export type FsState = z.infer<typeof fsStateSchema>;

export const fsStateRecordSchema = z.object({
  ms_since_boot: z.number(),
  state: fsStateSchema,
  gn2_drain: z.boolean(),
  gn2_fill: z.boolean(),
  depress: z.boolean(),
  press_pilot: z.boolean(),
  run: z.boolean(),
  lox_fill: z.boolean(),
  lox_disconnect: z.boolean(),
  igniter: z.boolean(),
  ereg_power: z.boolean(),
});

export type FsStateRecord = z.infer<typeof fsStateRecordSchema>;

export const fsLoxGn2TransducersRecordSchema = z.object({
  ts: z.number(),
  oxtank_1: z.number(),
  oxtank_2: z.number(),
  copv_1: z.number(),
  copv_2: z.number(),
  pilot_pres: z.number(),
  qd_pres: z.number(),
  ereg_closed: z.boolean(),
  ereg_stage_1: z.boolean(),
  ereg_stage_2: z.boolean(),
  oxtank_1_median: z.number(),
  oxtank_2_median: z.number(),
  copv_1_median: z.number(),
  copv_2_median: z.number(),
  pilot_pres_median: z.number(),
  qd_pres_median: z.number(),
});

export type FsLoxGn2TransducersRecord = z.infer<
  typeof fsLoxGn2TransducersRecordSchema
>;

export const fsInjectorTransducersRecordSchema = z.object({
  ts: z.number(),
  injector_1: z.number(),
  injector_2: z.number(),
  upper_cc: z.number(),
  injector_manifold_1: z.number(),
  injector_manifold_1_median: z.number(),
  injector_manifold_2_median: z.number(),
});

export type FsInjectorTransducersRecord = z.infer<
  typeof fsInjectorTransducersRecordSchema
>;

export const fsThermocouplesRecordSchema = z.object({
  ts: z.number(),
  gn2_internal_celsius: z.number(),
  gn2_external_celsius: z.number(),
  lox_upper_celsius: z.number(),
  lox_lower_celsius: z.number(),
  dummy: z.number().optional(),
  lox_celsius: z.number().optional(),
  gn2_celsius: z.number().optional(),
  gn2_surface_celsius: z.number().optional(),
});

export type FsThermocouplesRecord = z.infer<typeof fsThermocouplesRecordSchema>;

export const loadCellRecordSchema = z.number();
export type LoadCellRecord = z.infer<typeof loadCellRecordSchema>;

export const radioGroundRecordSchema = z.object({
  gps_ts_tail: z.number(),
  gps_fix: z.boolean(),
  gps_fixquality: z.number(),
  gps_satellites: z.number(),
  gps_latitude_fixed: z.number(),
  gps_longitude_fixed: z.number(),
  gps_altitude: z.number(),
  imu_az: z.number(),
});

export type RadioGroundRecord = z.infer<typeof radioGroundRecordSchema>;

export const relayCurrentMonitorRecordSchema = z.object({
  ts: z.number(),
  gn2_drain_ma: z.number(),
  gn2_fill_ma: z.number(),
  depress_ma: z.number(),
  press_pilot_ma: z.number(),
  run_ma: z.number(),
  lox_fill_ma: z.number(),
  lox_disconnect_ma: z.number(),
  igniter_ma: z.number(),
  ereg_power_ma: z.number(),
});

export type RelayCurrentMonitorRecord = z.infer<
  typeof relayCurrentMonitorRecordSchema
>;

export const capFillRecordSchema = z.object({
  ts: z.number(),
  cap_fill_base: z.number(),
  cap_fill_actual: z.number(),
  board_temp: z.number(),
});

export type CapFillRecord = z.infer<typeof capFillRecordSchema>;
