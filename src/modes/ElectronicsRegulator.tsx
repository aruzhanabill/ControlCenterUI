import { memo, useCallback } from "react";

import {
  useLaunchMachineActorRef,
  useLaunchMachineSelector,
} from "@/components/launchMachineProvider";

type EregCommand = "EREG_CLOSED" | "EREG_STAGE_1" | "EREG_STAGE_2";

interface StageConfig {
  command: EregCommand;
  activeField: "ereg_closed" | "ereg_stage_1" | "ereg_stage_2";
  name: string;
  description: string;
  color: "blue" | "green" | "red";
}

const STAGE_CONFIGS: StageConfig[] = [
  {
    command: "EREG_STAGE_1",
    activeField: "ereg_stage_1",
    name: "Stage 1",
    description: "Slow fill to 450 PSI",
    color: "blue",
  },
  {
    command: "EREG_STAGE_2",
    activeField: "ereg_stage_2",
    name: "Stage 2",
    description: "PID-controlled, launch",
    color: "green",
  },
  {
    command: "EREG_CLOSED",
    activeField: "ereg_closed",
    name: "Close",
    description: "Close I-port valve",
    color: "red",
  },
];

const COLORS = {
  blue: {
    active: "bg-blue-solid text-white ring-2 ring-blue-border",
    inactive: "bg-gray-el-bg hover:bg-gray-el-bg-hover text-gray-text",
    dot: "bg-blue-solid",
    text: "#228be6",
  },
  green: {
    active: "bg-green-solid text-white ring-2 ring-green-border",
    inactive: "bg-gray-el-bg hover:bg-gray-el-bg-hover text-gray-text",
    dot: "bg-green-solid",
    text: "#37b24d",
  },
  red: {
    active: "bg-red-solid text-white ring-2 ring-red-border",
    inactive: "bg-gray-el-bg hover:bg-gray-el-bg-hover text-gray-text",
    dot: "bg-red-solid",
    text: "#f03e3e",
  },
};

const GAIN_PRESETS = [
  { label: "Default", kp: 0.065, ki: 0.3, kd: 0.0001 },
  { label: "Option 1", kp: 0.0975, ki: 0.45, kd: 0.0001 },
  { label: "Option 2", kp: 0.13, ki: 0.6, kd: 0.00025 },
  { label: "Option 3", kp: 0.163, ki: 0.75, kd: 0.00025 },
  { label: "Option 4", kp: 0.195, ki: 0.9, kd: 0.00025 },
];

interface StageButtonProps {
  stage: StageConfig;
  isActive: boolean;
  canSend: boolean;
  onCommand: (command: EregCommand) => void;
}

const StageButton = memo(function StageButton({
  stage,
  isActive,
  canSend,
  onCommand,
}: StageButtonProps) {
  const handleClick = useCallback(() => {
    onCommand(stage.command);
  }, [stage.command, onCommand]);

  const colors = COLORS[stage.color];

  return (
    <button
      onClick={handleClick}
      disabled={!canSend || isActive}
      className={`px-3 py-2 rounded-lg transition-all text-left flex items-center gap-3 ${
        isActive ? colors.active : colors.inactive
      } ${!canSend || isActive ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <div
        className={`shrink-0 w-2 h-2 rounded-full ${isActive ? "bg-white animate-pulse" : "bg-gray-solid"}`}
      />
      <div className="flex flex-col">
        <span className="text-sm font-semibold leading-tight">
          {stage.name}
        </span>
        <span className="text-xs leading-tight opacity-70">
          {stage.description}
        </span>
      </div>
    </button>
  );
});

interface GainButtonProps {
  label: string;
  kp: number;
  ki: number;
  kd: number;
  canSend: boolean;
  onSend: (kp: number, ki: number, kd: number) => void;
}

const GainButton = memo(function GainButton({
  label,
  kp,
  ki,
  kd,
  canSend,
  onSend,
}: GainButtonProps) {
  const handleClick = useCallback(() => {
    onSend(kp, ki, kd);
  }, [kp, ki, kd, onSend]);

  return (
    <button
      onClick={handleClick}
      disabled={!canSend}
      className={`flex flex-col items-center px-2 py-1 text-xs border rounded bg-gray-el-bg text-gray-text border-gray-border transition-all gap-0.5 ${canSend ? "hover:bg-gray-el-bg-hover" : "opacity-50 cursor-not-allowed"}`}
    >
      <span className="font-semibold">{label}</span>
      <span className="font-mono leading-none text-[10px] text-gray-text-dim">
        {kp}/{ki}/{kd}
      </span>
    </button>
  );
});

export const ElectronicsRegulator = memo(function ElectronicsRegulator() {
  const launchActorRef = useLaunchMachineActorRef();
  const eregData = useLaunchMachineSelector(
    (state) => state.context.deviceStates.fsLoxGn2Transducers?.data ?? null,
  );

  const eregPowerOn = useLaunchMachineSelector(
    (state) => state.context.deviceStates.fsState?.data.ereg_power ?? false,
  );

  const eregPowerMa = useLaunchMachineSelector(
    (state) =>
      state.context.deviceStates.relayCurrentMonitor?.data.ereg_power_ma ??
      null,
  );

  const canSendStage1 = useLaunchMachineSelector((state) =>
    state.can({ type: "SEND_FS_COMMAND", value: { command: "EREG_STAGE_1" } }),
  );
  const canSendStage2 = useLaunchMachineSelector((state) =>
    state.can({ type: "SEND_FS_COMMAND", value: { command: "EREG_STAGE_2" } }),
  );

  const fsStateExists = useLaunchMachineSelector(
    (state) => !!state.context.deviceStates.fsState,
  );

  const isEregClosed = eregData?.ereg_closed ?? false;
  const canWrite = canSendStage1 || canSendStage2;
  const canSendClosed = canWrite && fsStateExists && !isEregClosed;

  const canSendMap: Record<EregCommand, boolean> = {
    EREG_STAGE_1: canSendStage1,
    EREG_STAGE_2: canSendStage2,
    EREG_CLOSED: canSendClosed,
  };

  const sendCommand = useCallback(
    (command: EregCommand) => {
      launchActorRef.send({ type: "SEND_FS_COMMAND", value: { command } });
      if (command === "EREG_CLOSED") {
        setTimeout(() => {
          launchActorRef.send({ type: "SEND_FS_COMMAND", value: { command } });
        }, 200);
      }
    },
    [launchActorRef],
  );

  const sendGains = useCallback(
    (kp: number, ki: number, kd: number) => {
      const value = { command: "EREG_SET_GAINS" as const, kp, ki, kd };
      launchActorRef.send({ type: "SEND_FS_COMMAND", value });
      setTimeout(() => {
        launchActorRef.send({ type: "SEND_FS_COMMAND", value });
      }, 200);
      console.log(`Sent EREG gains: Kp=${kp}, Ki=${ki}, Kd=${kd}`);
    },
    [launchActorRef],
  );

  const activeStage = STAGE_CONFIGS.find(
    (s) => eregData?.[s.activeField] ?? false,
  );

  return (
    <div className="flex flex-col p-4 border bg-gray-bg-1 rounded-xl border-gray-border gap-3">
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold text-gray-text">
          Electronics regulator
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-text-dim">PWR</span>
          <div
            className={`w-2 h-2 rounded-full ${eregPowerOn ? "bg-green-solid" : "bg-gray-solid"}`}
          />
          {eregPowerMa !== null && (
            <span className="text-xs text-gray-text-dim tabular-nums">
              {(eregPowerMa / 1000).toFixed(2)}A
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-2 border rounded-lg bg-gray-el-bg border-gray-border">
        <span className="text-xs text-gray-text-dim">Current state</span>
        {eregData ? (
          <span
            className="text-sm font-bold"
            style={{
              color: activeStage ? COLORS[activeStage.color].text : undefined,
            }}
          >
            {activeStage?.name ?? "Unknown"}
          </span>
        ) : (
          <span className="text-xs text-yellow-text animate-pulse">
            Waiting...
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {STAGE_CONFIGS.map((stage) => (
          <StageButton
            key={stage.command}
            stage={stage}
            isActive={eregData?.[stage.activeField] ?? false}
            canSend={canSendMap[stage.command]}
            onCommand={sendCommand}
          />
        ))}
      </div>

      <div className="pt-2 border-t border-gray-border">
        <p className="mb-2 text-xs text-gray-text-dim">PID gain presets</p>
        <div className="flex flex-wrap gap-1.5">
          {GAIN_PRESETS.map((preset) => (
            <GainButton
              key={preset.label}
              label={preset.label}
              kp={preset.kp}
              ki={preset.ki}
              kd={preset.kd}
              canSend={canWrite && fsStateExists}
              onSend={sendGains}
            />
          ))}
        </div>
      </div>

      {!canSendStage1 && !canSendStage2 && !fsStateExists && (
        <div className="px-3 py-2 text-xs border rounded-lg bg-red-bg border-red-border text-red-text">
          ⚠ Cannot send commands — check system state
        </div>
      )}
    </div>
  );
});
