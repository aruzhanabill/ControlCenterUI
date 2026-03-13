import { memo, useCallback, useState } from "react";
import { twMerge } from "tailwind-merge";

import { type FsStateRecord } from "@/lib/serverSchemas";

import { Button } from "./design/button";
import { CheckboxEntry } from "./design/checkboxEntry";
import {
  useLaunchMachineActorRef,
  useLaunchMachineSelector,
} from "./launchMachineProvider";

type RelaysState = Omit<FsStateRecord, "state" | "ms_since_boot">;

const Entry = memo(function Entry({
  label,
  field,
  pr: pendingRelays,
  spr: setPendingRelays,
}: {
  label: string;
  field: keyof RelaysState;
  pr: RelaysState | null; // pendingRelays
  spr: (pendingRelays: RelaysState) => void; // setPendingRelays
}) {
  const fsState = useLaunchMachineSelector(
    (state) => state.context.deviceStates.fsState?.data,
  );

  const checked = !!fsState?.[field];
  const hasPending = pendingRelays != null;

  const handleChange = useCallback(() => {
    if (hasPending) {
      setPendingRelays({
        ...pendingRelays,
        [field]: !pendingRelays[field],
      });
    } else if (fsState) {
      setPendingRelays(fsState);
    }
  }, [field, fsState, hasPending, pendingRelays, setPendingRelays]);

  return (
    <div
      className={twMerge(
        "rounded-lg",
        hasPending && "ring",
        hasPending &&
          (pendingRelays[field] ? "ring-green-border" : "ring-red-border"),
      )}
    >
      <CheckboxEntry
        size="lg"
        backgroundColor={
          hasPending ? (pendingRelays[field] ? "green" : "red") : "gray"
        }
        label={label}
        checked={checked}
        disabled={!fsState}
        onChange={handleChange}
      />
    </div>
  );
});

export const RelaysGroup = memo(function RelaysGroup() {
  const launchActorRef = useLaunchMachineActorRef();
  const [pendingRelays, setPendingRelays] = useState<RelaysState | null>(null);

  const setPendingRelaysDisabled = useLaunchMachineSelector(
    (state) =>
      pendingRelays == null ||
      !state.can({
        type: "SEND_FS_COMMAND",
        value: { command: "STATE_CUSTOM", ...pendingRelays },
      }),
  );

  const cancelPendingRelays = useCallback(() => {
    setPendingRelays(null);
  }, []);

  const handleSetPendingRelays = useCallback(() => {
    if (pendingRelays == null) return;
    launchActorRef.send({
      type: "SEND_FS_COMMAND",
      value: { command: "STATE_CUSTOM", ...pendingRelays },
    });
    cancelPendingRelays();
  }, [launchActorRef, pendingRelays, cancelPendingRelays]);

  // for brevity
  const pr = pendingRelays;
  const spr = setPendingRelays;

  return (
    <div className="flex items-center gap-6">
      {pendingRelays != null && (
        <div className="flex items-center gap-4">
          <Button
            color="green"
            disabled={setPendingRelaysDisabled}
            onClick={handleSetPendingRelays}
          >
            Set
          </Button>
          <Button color="red" disabled={false} onClick={cancelPendingRelays}>
            Cancel
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Entry label="GN2 Drain" field="gn2_drain" pr={pr} spr={spr} />
        <Entry label="GN2 Fill" field="gn2_fill" pr={pr} spr={spr} />
        <Entry label="Depress" field="depress" pr={pr} spr={spr} />
        <Entry label="Press Pilot" field="press_pilot" pr={pr} spr={spr} />
        <Entry label="Run" field="run" pr={pr} spr={spr} />
        <Entry label="LOx Fill" field="lox_fill" pr={pr} spr={spr} />
        <Entry label="LOx Disc" field="lox_disconnect" pr={pr} spr={spr} />
        <Entry label="Igniter" field="igniter" pr={pr} spr={spr} />
        <Entry label="EREG Power" field="ereg_power" pr={pr} spr={spr} />
      </div>
    </div>
  );
});
