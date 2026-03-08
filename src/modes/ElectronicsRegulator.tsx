import { memo, useCallback, useMemo } from "react";

import {
  useLaunchMachineActorRef,
  useLaunchMachineSelector,
} from "@/components/launchMachineProvider";
import { useTelemetryStore } from "@/stores/telemetryStore";

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

export const ElectronicsRegulator = memo(function ElectronicsRegulator() {
  const launchActorRef = useLaunchMachineActorRef();
  const telemetryStore = useTelemetryStore();

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

  const activeStage = STAGE_CONFIGS.find(
    (s) => eregData?.[s.activeField] ?? false,
  );

  const pressureWarnings = useMemo(() => {
    const now = Date.now() * 1000;
    const recentTime = now - 5 * 1e6;

    const copv1Samples = telemetryStore.getSamples(
      "copv_1_psi",
      recentTime,
      now,
    );
    const copv2Samples = telemetryStore.getSamples(
      "copv_2_psi",
      recentTime,
      now,
    );
    const oxtank1Samples = telemetryStore.getSamples(
      "oxtank_1_psi",
      recentTime,
      now,
    );
    const oxtank2Samples = telemetryStore.getSamples(
      "oxtank_2_psi",
      recentTime,
      now,
    );
    const oxtank3Samples = telemetryStore.getSamples(
      "oxtank_3_psi",
      recentTime,
      now,
    );

    const copv1 = copv1Samples[copv1Samples.length - 1]?.value ?? 0;
    const copv2 = copv2Samples[copv2Samples.length - 1]?.value ?? 0;
    const oxtank1 = oxtank1Samples[oxtank1Samples.length - 1]?.value ?? 0;
    const oxtank2 = oxtank2Samples[oxtank2Samples.length - 1]?.value ?? 0;
    const oxtank3 = oxtank3Samples[oxtank3Samples.length - 1]?.value ?? 0;

    const copvDiff = Math.abs(copv1 - copv2);
    const oxtank12Diff = Math.abs(oxtank1 - oxtank2);
    const oxtank23Diff = Math.abs(oxtank2 - oxtank3);

    const warnings = [];

    if (copvDiff > 50) {
      warnings.push(`COPV 1-2: ${copvDiff.toFixed(0)} PSI`);
    }
    if (oxtank12Diff > 50) {
      warnings.push(`Oxtank 1-2: ${oxtank12Diff.toFixed(0)} PSI`);
    }
    if (oxtank23Diff > 50) {
      warnings.push(`Oxtank 2-3: ${oxtank23Diff.toFixed(0)} PSI`);
    }

    return warnings;
  }, [telemetryStore]);

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

      {pressureWarnings.length > 0 && (
        <div className="flex items-center px-2 py-1 border rounded-md bg-red-bg border-red-border gap-2">
          <span className="text-xs text-red-text">🚩</span>
          <div className="flex-1 text-xs text-red-text">
            {pressureWarnings.join(" • ")}
          </div>
        </div>
      )}

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

      {!canSendStage1 && !canSendStage2 && !canSendClosed && (
        <div className="px-3 py-2 text-xs border rounded-lg bg-red-bg border-red-border text-red-text">
          ⚠ Cannot send commands — check system state
        </div>
      )}
    </div>
  );
});
