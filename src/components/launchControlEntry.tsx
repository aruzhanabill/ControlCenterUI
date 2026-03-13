import { memo, useCallback, useMemo } from "react";
import { twMerge } from "tailwind-merge";

import { type LaunchState } from "@/lib/launchState";
import { type FsCommand } from "@/lib/serverSchemas";
import { fsStateToCommand } from "@/lib/serverSchemaUtils";
import { type LaunchMachineEvent } from "@/machines/launchMachine";

import { StatusButton } from "./design/statusButton";
import {
  useLaunchMachineActorRef,
  useLaunchMachineSelector,
} from "./launchMachineProvider";

export type LaunchControlEntryState =
  | "not-ready"
  | "not-started"
  | "executing"
  | "stopped";
type Props = {
  label: string;
  isAbort?: boolean;
  fadeIfDisabled?: boolean;
} & (
  | {
      type: "fs-command";
      executeCommand: Exclude<FsCommand, "STATE_CUSTOM" | "EREG_SET_GAINS">;
      stopCommand: Exclude<FsCommand, "STATE_CUSTOM" | "EREG_SET_GAINS"> | null;
      field?: undefined;
    }
  | {
      type: "arm";
      executeCommand?: undefined;
      stopCommand?: undefined;
      field: keyof LaunchState["armStatus"];
    }
);
export const LaunchControlEntry = memo(function LaunchControlEntry({
  label,
  isAbort = false,
  fadeIfDisabled = false,
  ...rest
}: Props) {
  const launchActorRef = useLaunchMachineActorRef();
  const executeEvent = useMemo<LaunchMachineEvent>(
    () =>
      rest.type === "fs-command"
        ? ({
            type: "SEND_FS_COMMAND",
            value: { command: rest.executeCommand },
          } as LaunchMachineEvent)
        : ({
            type: "UPDATE_ARM_STATUS",
            data: { [rest.field]: true },
          } as unknown as LaunchMachineEvent),
    [rest.executeCommand, rest.field, rest.type],
  );
  const stopEvent = useMemo<LaunchMachineEvent | null>(
    () =>
      rest.type === "fs-command"
        ? rest.stopCommand != null
          ? ({
              type: "SEND_FS_COMMAND",
              value: { command: rest.stopCommand },
            } as LaunchMachineEvent)
          : null
        : ({
            type: "UPDATE_ARM_STATUS",
            data: { [rest.field]: false },
          } as unknown as LaunchMachineEvent),
    [rest.field, rest.stopCommand, rest.type],
  );
  const executeDisabled = useLaunchMachineSelector(
    (state) => !state.can(executeEvent),
  );
  const stopDisabled = useLaunchMachineSelector(
    (state) => state.can(executeEvent) || !stopEvent || !state.can(stopEvent),
  );
  const isExecuting = useLaunchMachineSelector((state) =>
    rest.type === "fs-command"
      ? !!state.context.deviceStates.fsState &&
        fsStateToCommand(state.context.deviceStates.fsState.data.state) ===
          rest.executeCommand
      : state.context.launchState.armStatus[rest.field],
  );
  const handleExecute = useCallback(() => {
    launchActorRef.send(executeEvent);
  }, [executeEvent, launchActorRef]);
  const handleStop = useCallback(() => {
    if (stopEvent) {
      launchActorRef.send(stopEvent);
    }
  }, [launchActorRef, stopEvent]);
  const isInState = useLaunchMachineSelector(
    (state) =>
      !!state.context.deviceStates.fsState &&
      fsStateToCommand(state.context.deviceStates.fsState.data.state) ===
        rest.executeCommand,
  );
  const fade = fadeIfDisabled && executeDisabled && !isInState;
  return (
    <div
      className={twMerge(
        "flex flex-col md:flex-row items-center px-4 py-3 border rounded-lg gap-4 bg-gray-el-bg border-gray-border",
        fade && "opacity-50 pointer-events-none",
      )}
    >
      <div className="flex items-center self-stretch md:self-center gap-4 grow">
        <div
          className={twMerge(
            "shrink-0 w-8 h-8 mr-2 rounded-full appearance-none",
            isExecuting
              ? isAbort
                ? "bg-red-solid"
                : "bg-green-solid"
              : "bg-gray-solid",
          )}
        />
        <p className="grow text-gray-text">{label}</p>
      </div>
      <div className="flex items-center gap-4">
        <StatusButton
          color="green"
          disabled={!fade && executeDisabled}
          onClick={handleExecute}
        >
          EXECUTE
        </StatusButton>
        <StatusButton
          color="red"
          disabled={!fade && stopDisabled}
          onClick={handleStop}
        >
          STOP
        </StatusButton>
      </div>
    </div>
  );
});
