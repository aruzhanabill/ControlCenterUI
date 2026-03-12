import { memo, useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  useLaunchMachineActorRef,
  useLaunchMachineSelector,
} from "@/components/launchMachineProvider";
import { catchError, useApi } from "@/hooks/useApi";
import { useEnvironmentKey } from "@/hooks/useEnvironmentKey";
import { useSessionName } from "@/hooks/useSessionName";
import { DEVICES, type FsCommandMessage } from "@/lib/serverSchemas";
import { useTelemetryStore } from "@/stores/telemetryStore";

import { FiringStationHealth } from "./FiringStationHealth";

interface Props {
  currentPath: string;
}

const RECALIBRATE_MESSAGES = [
  {
    label: "Recalibrate transducers",
    device: DEVICES.firingStation,
    data: { command: "RECALIBRATE_TRANSDUCERS" } satisfies FsCommandMessage,
  },
  {
    label: "Recalibrate load cell 1",
    device: DEVICES.loadCell1,
    data: "calibrate",
  },
  {
    label: "Recalibrate load cell 2",
    device: DEVICES.loadCell2,
    data: "calibrate",
  },
];

export const ModeNav = memo(function ModeNav({ currentPath }: Props) {
  const connected = useTelemetryStore((state) => state.connected);
  const { environmentKey } = useParams<{ environmentKey: string }>();
  const launchActorRef = useLaunchMachineActorRef();
  const api = useApi();
  const envKey = useEnvironmentKey();
  const sessionName = useSessionName();

  const [healthOpen, setHealthOpen] = useState(false);
  const [utilsOpen, setUtilsOpen] = useState(false);

  const openHealth = useCallback(() => setHealthOpen(true), []);
  const closeHealth = useCallback(() => setHealthOpen(false), []);
  const toggleUtils = useCallback(() => setUtilsOpen((prev) => !prev), []);
  const closeUtils = useCallback(() => setUtilsOpen(false), []);

  const msSinceBoot = useLaunchMachineSelector(
    (state) => state.context.deviceStates.fsState?.data.ms_since_boot ?? null,
  );
  const uptimeSeconds =
    msSinceBoot !== null ? Math.floor(msSinceBoot / 1000) : null;

  const pilotPressure = useTelemetryStore(
    (state) => state.buffers.get("pilot_pres_psi")?.getLatest()?.value ?? null,
  );

  const copv1Pressure = useTelemetryStore(
    (state) => state.buffers.get("copv_1_psi")?.getLatest()?.value ?? null,
  );

  const copv2Pressure = useTelemetryStore(
    (state) => state.buffers.get("copv_2_psi")?.getLatest()?.value ?? null,
  );

  const pilotHigh = pilotPressure !== null && pilotPressure > 460;
  const copv1High = copv1Pressure !== null && copv1Pressure > 4400;
  const copv2High = copv2Pressure !== null && copv2Pressure > 4400;
  const anyWarning = pilotHigh || copv1High || copv2High;

  const canSend = useLaunchMachineSelector((state) =>
    state.can({ type: "SEND_MANUAL_MESSAGES", messages: [] }),
  );

  const usingCustomSession = sessionName != null;

  const handleRecalibrateAll = useCallback(() => {
    if (!canSend) return;
    launchActorRef.send({
      type: "SEND_MANUAL_MESSAGES",
      messages: RECALIBRATE_MESSAGES.map((m) => ({
        device: m.device,
        data: m.data,
      })),
    });
    setUtilsOpen(false);
  }, [launchActorRef, canSend]);

  const handleRestart = useCallback(() => {
    if (!canSend) return;
    launchActorRef.send({
      type: "SEND_MANUAL_MESSAGES",
      messages: [
        { device: DEVICES.firingStation, data: { command: "RESTART" } },
      ],
    });
    setUtilsOpen(false);
  }, [launchActorRef, canSend]);

  const handleNewSession = useCallback(() => {
    if (usingCustomSession) return;
    catchError(api.sessions.create.post({ environmentKey: envKey }));
    setUtilsOpen(false);
  }, [api, envKey, usingCustomSession]);

  const isControl = currentPath.includes("/control");
  const isData = currentPath.includes("/data");

  return (
    <nav className="border-b border-gray-border bg-gray-bg-1">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold tracking-tight text-gray-text">
            Rocket Control Center
          </div>

          {/* Connection status */}
          <div
            className={`ml-4 flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
              connected
                ? "bg-green-bg text-green-text"
                : "bg-red-bg text-red-text"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${connected ? "bg-green-solid animate-pulse" : "bg-red-solid"}`}
            />
            {connected ? "CONNECTED" : "DISCONNECTED"}
          </div>

          <div className="px-3 py-1 ml-2 text-xs rounded-full bg-gray-bg-2 text-gray-text-dim tabular-nums">
            FS UP: {uptimeSeconds !== null ? `${uptimeSeconds}s` : "—"}
          </div>

          {/* Pressure warnings */}
          {anyWarning && (
            <div className="flex items-center px-3 py-1 ml-2 text-xs border-2 rounded-full bg-yellow-bg text-yellow-text border-yellow-solid gap-2">
              <span>⚠</span>
              <span className="font-semibold">
                PRESSURE{" "}
                {[
                  pilotHigh && "PILOT",
                  copv1High && "COPV1",
                  copv2High && "COPV2",
                ]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/${environmentKey}/control`}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              isControl
                ? "bg-blue-solid text-white shadow-lg"
                : "bg-gray-el-bg text-gray-text hover:bg-gray-el-bg-hover"
            }`}
          >
            CONTROL
          </Link>
          <Link
            to={`/${environmentKey}/data`}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              isData
                ? "bg-blue-solid text-white shadow-lg"
                : "bg-gray-el-bg text-gray-text hover:bg-gray-el-bg-hover"
            }`}
          >
            DATA DISPLAY
          </Link>

          {/* Utilities Dropdown */}
          <div className="relative">
            <button
              onClick={toggleUtils}
              className="px-4 py-2 font-semibold rounded-lg bg-gray-el-bg text-gray-text hover:bg-gray-el-bg-hover transition-all"
            >
              ⚙
            </button>

            {utilsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={closeUtils} />
                <div className="absolute right-0 z-50 w-64 p-3 mt-2 bg-white border rounded-lg shadow-xl border-gray-border">
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={openHealth}
                      className="px-3 py-2 text-sm font-medium text-left text-white rounded-lg bg-blue-solid hover:bg-blue-solid-hover transition-all"
                    >
                      FS health
                    </button>
                    <button
                      onClick={handleRecalibrateAll}
                      disabled={!canSend}
                      className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition-all ${
                        canSend
                          ? "bg-blue-solid hover:bg-blue-solid-hover text-white"
                          : "bg-gray-el-bg text-gray-text-dim cursor-not-allowed"
                      }`}
                    >
                      Recalibrate all
                    </button>
                    <button
                      onClick={handleRestart}
                      disabled={!canSend}
                      className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition-all ${
                        canSend
                          ? "bg-gray-el-bg hover:bg-gray-el-bg-hover text-gray-text border border-gray-border"
                          : "bg-gray-el-bg text-gray-text-dim cursor-not-allowed"
                      }`}
                    >
                      Restart
                    </button>
                    <button
                      onClick={handleNewSession}
                      disabled={usingCustomSession}
                      className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition-all ${
                        !usingCustomSession
                          ? "bg-blue-solid hover:bg-blue-solid-hover text-white"
                          : "bg-gray-el-bg text-gray-text-dim cursor-not-allowed"
                      }`}
                    >
                      New session
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {healthOpen && <FiringStationHealth onClose={closeHealth} />}
    </nav>
  );
});
