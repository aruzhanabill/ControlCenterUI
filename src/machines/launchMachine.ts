import { assign, createMachine } from "xstate";
import { z } from "zod";

import { Api, catchError } from "@/hooks/useApi";
import {
  ActivePanel,
  initialLaunchState,
  LAUNCH_STATE_DEVICE,
  LaunchState,
  launchStateSchema,
} from "@/lib/launchState";
import {
  DEVICES,
  FsCommandMessage,
  FsInjectorTransducersRecord,
  fsInjectorTransducersRecordSchema,
  FsLoxGn2TransducersRecord,
  fsLoxGn2TransducersRecordSchema,
  FsStateRecord,
  fsStateRecordSchema,
  FsThermocouplesRecord,
  fsThermocouplesRecordSchema,
  LoadCellRecord,
  loadCellRecordSchema,
  RadioGroundRecord,
  radioGroundRecordSchema,
  RelayCurrentMonitorRecord,
  relayCurrentMonitorRecordSchema,
} from "@/lib/serverSchemas";
import { fsStateToCommand } from "@/lib/serverSchemaUtils";

const LAUNCH_STATE_FETCH_INTERVAL = 1000;
const STATION_STATE_FETCH_INTERVAL = 0;

export type DeviceRecord<T> = {
  ts: number;
  data: T;
};

export type DeviceStates = {
  fsState: DeviceRecord<FsStateRecord> | null;
  fsLoxGn2Transducers: DeviceRecord<FsLoxGn2TransducersRecord> | null;
  fsInjectorTransducers: DeviceRecord<FsInjectorTransducersRecord> | null;
  fsThermocouples: DeviceRecord<FsThermocouplesRecord> | null;
  loadCell1: DeviceRecord<LoadCellRecord> | null;
  loadCell2: DeviceRecord<LoadCellRecord> | null;
  radioGround: DeviceRecord<RadioGroundRecord> | null;
  relayCurrentMonitor: DeviceRecord<RelayCurrentMonitorRecord> | null;
};

export interface PendingMessage {
  device: string;
  data: unknown;
}

export interface SentMessage {
  ts: Date;
  device: string;
  data: unknown;
}

export type LaunchMachineEvent =
  | { type: "DISMISS_NETWORK_ERROR" }
  | { type: "UPDATE_ACTIVE_PANEL"; value: ActivePanel }
  | { type: "UPDATE_MAIN_STATUS"; data: Partial<LaunchState["mainStatus"]> }
  | { type: "UPDATE_ARM_STATUS"; data: Partial<LaunchState["armStatus"]> }
  | { type: "UPDATE_PRE_FILL_CHECKLIST"; data: Partial<LaunchState["preFillChecklist"]> }
  | { type: "UPDATE_RANGE_PERMIT"; data: Partial<LaunchState["rangePermit"]> }
  | { type: "SEND_FS_COMMAND"; value: FsCommandMessage }
  | { type: "SEND_MANUAL_MESSAGES"; messages: PendingMessage[] };

export function createLaunchMachine(
  api: Api,
  environmentKey: string,
  sessionName?: string,
  readonly = false,
  replayFromSeconds?: number,
) {
  const startTimeMicros = Date.now() * 1000;
  const canWrite = !readonly && sessionName == null;

  return createMachine(
    {
      predictableActionArguments: true,
      schema: {
        events: {} as LaunchMachineEvent,
        context: {} as {
          startTimeMicros: number;
          launchState: LaunchState;
          pendingLaunchState: LaunchState | null;
          deviceStates: DeviceStates;
          sentMessages: SentMessage[];
        },
        services: {} as {
          fetchLaunchState: { data: LaunchState };
          mutateLaunchState: { data: LaunchState };
          fetchDeviceStates: { data: DeviceStates };
          sendFsCommand: { data: SentMessage[] };
          sendManualMessages: { data: SentMessage[] };
        },
      },
      id: "launch",
      context: () => ({
        startTimeMicros,
        launchState: initialLaunchState,
        pendingLaunchState: null,
        deviceStates: {
          fsState: null,
          fsLoxGn2Transducers: null,
          fsInjectorTransducers: null,
          fsThermocouples: null,
          loadCell1: null,
          loadCell2: null,
          radioGround: null,
          relayCurrentMonitor: null,
        },
        sentMessages: [],
      }),
      initial: "live",
      states: {
        live: {
          type: "parallel",
          states: {
            launchState: {
              initial: "fetching",
              states: {
                fetching: {
                  invoke: {
                    src: "fetchLaunchState",
                    onDone: { target: "idle", actions: "setLaunchState" },
                    onError: "#launch.networkError",
                  },
                },
                idle: {
                  always: { cond: "hasPendingLaunchState", target: "mutating" },
                  on: {
                    UPDATE_ACTIVE_PANEL: { actions: "updateActivePanel", cond: "canWrite" },
                    UPDATE_MAIN_STATUS: { actions: "updateMainStatus", cond: "canWrite" },
                    UPDATE_ARM_STATUS: { actions: "updateArmStatus", cond: "canWrite" },
                    UPDATE_PRE_FILL_CHECKLIST: { actions: "updatePreFillChecklist", cond: "canWrite" },
                    UPDATE_RANGE_PERMIT: { actions: "updateRangePermit", cond: "canWrite" },
                  },
                  initial: "waitingToRefetch",
                  states: {
                    waitingToRefetch: {
                      after: { [LAUNCH_STATE_FETCH_INTERVAL]: "refetching" },
                    },
                    refetching: {
                      invoke: {
                        src: "fetchLaunchState",
                        onDone: { target: "waitingToRefetch", actions: "setLaunchState" },
                        onError: "#launch.networkError",
                      },
                    },
                  },
                },
                mutating: {
                  invoke: {
                    src: "mutateLaunchState",
                    onDone: { target: "idle", actions: "setLaunchState" },
                    onError: "#launch.networkError",
                  },
                  exit: "clearPendingLaunchState",
                },
              },
            },
            stationState: {
              initial: "fetching",
              states: {
                fetching: {
                  invoke: {
                    src: "fetchDeviceStates",
                    onDone: { target: "idle", actions: "setDeviceStates" },
                    onError: "#launch.networkError",
                  },
                },
                idle: {
                  on: {
                    SEND_FS_COMMAND: { target: "sendingFsCommand", cond: "canSendFsCommand" },
                    SEND_MANUAL_MESSAGES: { target: "sendingManualMessages", cond: "canWrite" },
                  },
                  initial: "waitingToRefetch",
                  states: {
                    waitingToRefetch: {
                      after: { [STATION_STATE_FETCH_INTERVAL]: "refetching" },
                    },
                    refetching: {
                      invoke: {
                        src: "fetchDeviceStates",
                        onDone: { target: "waitingToRefetch", actions: "setDeviceStates" },
                        onError: "#launch.networkError",
                      },
                    },
                  },
                },
                sendingFsCommand: {
                  invoke: {
                    src: "sendFsCommand",
                    onDone: { target: "idle.refetching", actions: "addSentMessages" },
                    onError: "#launch.networkError",
                  },
                },
                sendingManualMessages: {
                  invoke: {
                    src: "sendManualMessages",
                    onDone: { target: "idle.refetching", actions: "addSentMessages" },
                    onError: "#launch.networkError",
                  },
                },
              },
            },
          },
        },
        networkError: {
          entry: "logNetworkError",
          on: { DISMISS_NETWORK_ERROR: "live" },
        },
      },
    },
    {
      actions: {
        clearPendingLaunchState: assign({
          pendingLaunchState: (_) => null,
        }),
        setLaunchState: assign({
          launchState: (_, event) => (event as unknown as { data: LaunchState }).data,
        }),
        updateActivePanel: assign({
          pendingLaunchState: (context, event) => ({
            ...context.launchState,
            activePanel: (event as { type: "UPDATE_ACTIVE_PANEL"; value: ActivePanel }).value,
          }),
        }),
        updateMainStatus: assign({
          pendingLaunchState: (context, event) => ({
            ...context.launchState,
            mainStatus: {
              ...context.launchState.mainStatus,
              ...(event as { data: Partial<LaunchState["mainStatus"]> }).data,
            },
          }),
        }),
        updateArmStatus: assign({
          pendingLaunchState: (context, event) => ({
            ...context.launchState,
            armStatus: {
              ...context.launchState.armStatus,
              ...(event as { data: Record<string, boolean> }).data,
            } as Record<string, boolean>,
          }),
        }),
        updatePreFillChecklist: assign({
          pendingLaunchState: (context, event) => ({
            ...context.launchState,
            preFillChecklist: {
              ...context.launchState.preFillChecklist,
              ...(event as { data: Record<string, boolean> }).data,
            } as Record<string, boolean>,
          }),
        }),
        updateRangePermit: assign({
          pendingLaunchState: (context, event) => ({
            ...context.launchState,
            rangePermit: {
              ...context.launchState.rangePermit,
              ...(event as { data: Record<string, boolean> }).data,
            } as Record<string, boolean>,
          }),
        }),
        setDeviceStates: assign((_context, event) => {
          return { deviceStates: (event as unknown as { data: DeviceStates }).data };
        }),
        logNetworkError: (_, event) => {
          console.error("Launch machine network error", event);
        },
        addSentMessages: assign((context, event) => {
          return {
            sentMessages: [...context.sentMessages, ...(event as unknown as { data: SentMessage[] }).data],
          };
        }),
      },
      services: {
        fetchLaunchState: async () => {
          const { records } = await catchError(
            api.records.get({
              $query: {
                environmentKey,
                sessionName,
                device: LAUNCH_STATE_DEVICE,
                take: "1",
              },
            }),
          );
          if (records.length === 0) {
            return initialLaunchState;
          }
          return launchStateSchema.parse(records[0].data);
        },
        mutateLaunchState: async (context) => {
          if (!context.pendingLaunchState) {
            throw new Error("No pending launch state");
          }
          await catchError(
            api.records.post({
              environmentKey,
              device: LAUNCH_STATE_DEVICE,
              data: context.pendingLaunchState,
            }),
          );
          return context.pendingLaunchState;
        },
        fetchDeviceStates: async () => {
          const curTimeMicros = Date.now() * 1000;
          const elapsedMicros = curTimeMicros - startTimeMicros;
          const endTs = replayFromSeconds != null ? String(elapsedMicros + replayFromSeconds * 1e6) : undefined;

          const records = await catchError(
            api.records.multiDevice.get({
              $query: {
                environmentKey,
                sessionName,
                devices: [
                  DEVICES.fsState,
                  DEVICES.fsLoxGn2Transducers,
                  DEVICES.fsInjectorTransducers,
                  DEVICES.fsThermocouples,
                  DEVICES.loadCell1,
                  DEVICES.loadCell2,
                  DEVICES.radioGround,
                  DEVICES.relayCurrentMonitor,
                ].join(","),
                endTs,
              },
            }),
          );

          const parseRecord = <T>(schema: z.ZodType<T>, record: DeviceRecord<unknown> | null) => {
            return record ? { ts: record.ts, data: schema.parse(record.data) } : null;
          };

          return {
            fsState: parseRecord(fsStateRecordSchema, records[DEVICES.fsState]),
            fsLoxGn2Transducers: parseRecord(fsLoxGn2TransducersRecordSchema, records[DEVICES.fsLoxGn2Transducers]),
            fsInjectorTransducers: parseRecord(
              fsInjectorTransducersRecordSchema,
              records[DEVICES.fsInjectorTransducers],
            ),
            fsThermocouples: parseRecord(fsThermocouplesRecordSchema, records[DEVICES.fsThermocouples]),
            loadCell1: parseRecord(loadCellRecordSchema, records[DEVICES.loadCell1]),
            loadCell2: parseRecord(loadCellRecordSchema, records[DEVICES.loadCell2]),
            radioGround: parseRecord(radioGroundRecordSchema, records[DEVICES.radioGround]),
            relayCurrentMonitor: parseRecord(relayCurrentMonitorRecordSchema, records[DEVICES.relayCurrentMonitor]),
          };
        },
        sendFsCommand: async (_context, event) => {
          const e = event as { type: "SEND_FS_COMMAND"; value: FsCommandMessage };
          await catchError(
            api.messages.post({
              environmentKey,
              device: DEVICES.firingStation,
              data: e.value,
            }),
          );
          console.log("Sent message", DEVICES.firingStation, e.value);
          return [{ ts: new Date(), device: DEVICES.firingStation, data: e.value }];
        },
        sendManualMessages: async (_, event) => {
          const e = event as { type: "SEND_MANUAL_MESSAGES"; messages: PendingMessage[] };
          await Promise.all(
            e.messages.map(async (message: PendingMessage) => {
              await catchError(
                api.messages.post({
                  environmentKey,
                  device: message.device,
                  data: message.data,
                }),
              );
              console.log("Sent message", message.device, message.data);
            }),
          );
          const ts = new Date();
          return e.messages.map((message: PendingMessage) => ({
            ts,
            device: message.device,
            data: message.data,
          }));
        },
      },
      guards: {
        hasPendingLaunchState: (context) => !!context.pendingLaunchState,
        canWrite: () => canWrite,
        canSendFsCommand: (context, event) => {
          if (!canWrite) return false;
          const e = event as { type: "SEND_FS_COMMAND"; value: FsCommandMessage };
          const fsState = context.deviceStates.fsState;
          if (e.value.command === "STATE_CUSTOM") return true;
          if (fsState && e.value.command === fsStateToCommand(fsState.data.state)) return false;
          if (e.value.command === "STATE_FIRE") {
            if (!fsState) return false;
            const state = fsState.data.state;
            return state === "GN2_STANDBY" || state === "CUSTOM";
          }
          return true;
        },
      },
    },
  );
}
