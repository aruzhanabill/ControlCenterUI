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

// Gain presets matching firmware defaults and variations
const GAIN_PRESETS = [
  { label: "Aggressive", kp: 0.45, ki: 3.0, kd: 0.015 },
  { label: "Default", kp: 0.35, ki: 2.5, kd: 0.01 },
  { label: "Moderate", kp: 0.28, ki: 2.0, kd: 0.008 },
  { label: "Conservative", kp: 0.2, ki: 1.5, kd: 0.005 },
  { label: "Slow", kp: 0.15, ki: 1.0, kd: 0.003 },
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
  onSend: (kp: number, ki: number, kd: number) => void;
}

const GainButton = memo(function GainButton({
  label,
  kp,
  ki,
  kd,
  onSend,
}: GainButtonProps) {
  const handleClick = useCallback(() => {
    onSend(kp, ki, kd);
  }, [kp, ki, kd, onSend]);

  return (
    <button
      onClick={handleClick}
      className="px-2 py-1 text-xs border rounded bg-gray-el-bg hover:bg-gray-el-bg-hover text-gray-text border-gray-border transition-all"
      title={`Kp=${kp}, Ki=${ki}, Kd=${kd}`}
    >
      {label}
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
  const canSendClosed = useLaunchMachineSelector((state) =>
    state.can({ type: "SEND_FS_COMMAND", value: { command: "EREG_CLOSED" } }),
  );

  const canSendMap: Record<EregCommand, boolean> = {
    EREG_STAGE_1: canSendStage1,
    EREG_STAGE_2: canSendStage2,
    EREG_CLOSED: canSendClosed,
  };

  const sendCommand = useCallback(
    (command: EregCommand) => {
      launchActorRef.send({ type: "SEND_FS_COMMAND", value: { command } });
    },
    [launchActorRef],
  );

  const sendGains = useCallback(
    (kp: number, ki: number, kd: number) => {
      console.log(`Setting EREG gains: Kp=${kp}, Ki=${ki}, Kd=${kd}`);
      launchActorRef.send({
        type: "SEND_FS_COMMAND",
        value: { command: "EREG_SET_GAINS", kp, ki, kd },
      });
    },
    [launchActorRef],
  );

  const activeStage = STAGE_CONFIGS.find(
    (s) => eregData?.[s.activeField] ?? false,
  );

  return (
    <div className="flex flex-col p-4 border bg-gray-bg-1 rounded-xl border-gray-border gap-3">
      {/* Header */}
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

      {/* Current state */}
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

      {/* Stage buttons */}
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
              onSend={sendGains}
            />
          ))}
        </div>
      </div>

      {!canSendStage1 && !canSendStage2 && !canSendClosed && (
        <div className="px-3 py-2 text-xs border rounded-lg bg-red-bg border-red-border text-red-text">
          ⚠ Cannot send commands — check system state
        </div>
      )}
    </div>
  );
});
