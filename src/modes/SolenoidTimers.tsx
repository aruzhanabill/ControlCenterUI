import { memo, useCallback, useEffect, useState } from "react";

import {
  useLaunchMachineActorRef,
  useLaunchMachineSelector,
} from "@/components/launchMachineProvider";

type SolenoidField =
  | "gn2_drain"
  | "gn2_fill"
  | "depress"
  | "press_pilot"
  | "run"
  | "lox_fill"
  | "lox_disconnect"
  | "igniter"
  | "ereg_power";

const SOLENOID_LABELS: Record<SolenoidField, string> = {
  gn2_drain: "GN2 Drain",
  gn2_fill: "GN2 Fill",
  depress: "Depress",
  press_pilot: "Press Pilot",
  run: "Run",
  lox_fill: "LOX Fill",
  lox_disconnect: "LOX Disconnect",
  igniter: "Igniter",
  ereg_power: "EREG Power",
};

interface ActiveTimer {
  field: SolenoidField;
  endTime: number;
}

interface SolenoidRowProps {
  field: SolenoidField;
  label: string;
  activeTimer: ActiveTimer | null;
  onStart: (field: SolenoidField, durationSec: number) => void;
  onStop: (field: SolenoidField) => void;
}

const SolenoidRow = memo(function SolenoidRow({
  field,
  label,
  activeTimer,
  onStart,
  onStop,
}: SolenoidRowProps) {
  const [duration, setDuration] = useState("5");
  const [, forceUpdate] = useState(0);

  const isActive = activeTimer?.field === field;
  const remainingMs = isActive
    ? Math.max(0, activeTimer!.endTime - Date.now())
    : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      forceUpdate((n) => n + 1);
    }, 100);
    return () => clearInterval(interval);
  }, [isActive]);

  const handleStart = useCallback(() => {
    const durationSec = parseFloat(duration);
    if (isNaN(durationSec) || durationSec <= 0) return;
    onStart(field, durationSec);
  }, [field, duration, onStart]);

  const handleStop = useCallback(() => {
    onStop(field);
  }, [field, onStop]);

  const handleDurationChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDuration(e.target.value);
    },
    [],
  );

  return (
    <div className="flex items-center px-2 border rounded gap-2 py-1.5 border-gray-border bg-gray-el-bg">
      <div
        className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "bg-green-solid" : "bg-gray-solid"}`}
      />

      <span className="text-xs text-gray-text min-w-[100px]">{label}</span>

      {!isActive ? (
        <>
          <input
            type="number"
            value={duration}
            onChange={handleDurationChange}
            min="0.1"
            step="0.1"
            className="w-16 px-2 font-mono text-xs text-center border rounded py-0.5 bg-gray-bg border-gray-border text-gray-text"
            placeholder="sec"
          />
          <button
            onClick={handleStart}
            className="px-3 text-xs text-white rounded py-0.5 bg-green-solid hover:bg-green-solid-hover transition-colors"
          >
            Start
          </button>
        </>
      ) : (
        <>
          <span className="font-mono text-xs font-bold text-center text-green-text tabular-nums min-w-[3rem]">
            {remainingSec}s
          </span>
          <button
            onClick={handleStop}
            className="px-3 text-xs text-white rounded py-0.5 bg-red-solid hover:bg-red-solid-hover transition-colors"
          >
            Stop
          </button>
        </>
      )}
    </div>
  );
});

export const SolenoidTimers = memo(function SolenoidTimers() {
  const launchActorRef = useLaunchMachineActorRef();
  const fsState = useLaunchMachineSelector(
    (state) => state.context.deviceStates.fsState?.data,
  );

  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);

  useEffect(() => {
    if (!activeTimer || !fsState) return;

    const checkTimer = () => {
      if (Date.now() >= activeTimer.endTime) {
        console.log(`Timer expired for ${activeTimer.field}, closing valve`);

        launchActorRef.send({
          type: "SEND_FS_COMMAND",
          value: {
            command: "STATE_CUSTOM",
            gn2_drain:
              activeTimer.field === "gn2_drain" ? false : fsState.gn2_drain,
            gn2_fill:
              activeTimer.field === "gn2_fill" ? false : fsState.gn2_fill,
            depress: activeTimer.field === "depress" ? false : fsState.depress,
            press_pilot:
              activeTimer.field === "press_pilot" ? false : fsState.press_pilot,
            run: activeTimer.field === "run" ? false : fsState.run,
            lox_fill:
              activeTimer.field === "lox_fill" ? false : fsState.lox_fill,
            lox_disconnect:
              activeTimer.field === "lox_disconnect"
                ? false
                : fsState.lox_disconnect,
            igniter: activeTimer.field === "igniter" ? false : fsState.igniter,
            ereg_power:
              activeTimer.field === "ereg_power" ? false : fsState.ereg_power,
          },
        });

        setActiveTimer(null);
      }
    };

    const interval = setInterval(checkTimer, 100);
    return () => clearInterval(interval);
  }, [activeTimer, fsState, launchActorRef]);

  const handleStart = useCallback(
    (field: SolenoidField, durationSec: number) => {
      if (!fsState) return;

      // Open the valve
      launchActorRef.send({
        type: "SEND_FS_COMMAND",
        value: {
          command: "STATE_CUSTOM",
          gn2_drain: field === "gn2_drain" ? true : fsState.gn2_drain,
          gn2_fill: field === "gn2_fill" ? true : fsState.gn2_fill,
          depress: field === "depress" ? true : fsState.depress,
          press_pilot: field === "press_pilot" ? true : fsState.press_pilot,
          run: field === "run" ? true : fsState.run,
          lox_fill: field === "lox_fill" ? true : fsState.lox_fill,
          lox_disconnect:
            field === "lox_disconnect" ? true : fsState.lox_disconnect,
          igniter: field === "igniter" ? true : fsState.igniter,
          ereg_power: field === "ereg_power" ? true : fsState.ereg_power,
        },
      });

      setActiveTimer({
        field,
        endTime: Date.now() + durationSec * 1000,
      });
    },
    [fsState, launchActorRef],
  );

  const handleStop = useCallback(
    (field: SolenoidField) => {
      if (!fsState) return;

      launchActorRef.send({
        type: "SEND_FS_COMMAND",
        value: {
          command: "STATE_CUSTOM",
          gn2_drain: field === "gn2_drain" ? false : fsState.gn2_drain,
          gn2_fill: field === "gn2_fill" ? false : fsState.gn2_fill,
          depress: field === "depress" ? false : fsState.depress,
          press_pilot: field === "press_pilot" ? false : fsState.press_pilot,
          run: field === "run" ? false : fsState.run,
          lox_fill: field === "lox_fill" ? false : fsState.lox_fill,
          lox_disconnect:
            field === "lox_disconnect" ? false : fsState.lox_disconnect,
          igniter: field === "igniter" ? false : fsState.igniter,
          ereg_power: field === "ereg_power" ? false : fsState.ereg_power,
        },
      });

      setActiveTimer(null);
    },
    [fsState, launchActorRef],
  );

  if (!fsState) {
    return (
      <div className="p-4 border bg-gray-el-bg rounded-xl border-gray-border">
        <p className="text-sm text-gray-text-dim">
          Waiting for solenoid data...
        </p>
      </div>
    );
  }

  const fields: SolenoidField[] = [
    "gn2_drain",
    "gn2_fill",
    "depress",
    "press_pilot",
    "run",
    "lox_fill",
    "lox_disconnect",
    "igniter",
    "ereg_power",
  ];

  return (
    <div className="flex flex-col p-3 border bg-gray-el-bg rounded-xl border-gray-border gap-2">
      <p className="mb-1 text-sm font-bold text-gray-text">
        Solenoid Countdown Timers
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {fields.map((field) => (
          <SolenoidRow
            key={field}
            field={field}
            label={SOLENOID_LABELS[field]}
            activeTimer={activeTimer}
            onStart={handleStart}
            onStop={handleStop}
          />
        ))}
      </div>
    </div>
  );
});
