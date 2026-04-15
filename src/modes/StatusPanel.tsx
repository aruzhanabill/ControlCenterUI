import {
  lazy,
  memo,
  type ReactNode,
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import { Panel } from "@/components/design/panel";
import { StatusDisplay } from "@/components/design/statusDisplay";
import { useLaunchMachineSelector } from "@/components/launchMachineProvider";
import { computeNitrousMass } from "@/lib/coolprop";
import { type DeviceStates } from "@/machines/launchMachine";

const StationChart = lazy(() =>
  import("@/components/stationChart").then((res) => ({
    default: res.StationChart,
  })),
);

const ChartLoadingFallback = memo(function ChartLoadingFallback({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <Suspense fallback={<p className="text-gray-text">Loading chart...</p>}>
      {children}
    </Suspense>
  );
});

const StatusDisplayWithChart = memo(function StatusDisplayWithChart({
  label,
  selector,
  decimals = 1,
  minY = 0,
  maxY = "dataMax + 10",
}: {
  label: string;
  selector: (state: DeviceStates) => { ts: number; value: number } | null;
  decimals?: number;
  minY?: string | number;
  maxY?: string | number;
}) {
  const value = useLaunchMachineSelector(
    (state) => selector(state.context.deviceStates)?.value ?? 0,
  );
  const valueStr = value.toFixed(decimals);

  const selectorRef = useRef(selector);

  const chartElement = useMemo(() => {
    return (
      <ChartLoadingFallback>
        <StationChart
          selector={selectorRef.current}
          valuePrecision={decimals}
          minY={minY}
          maxY={maxY}
        />
      </ChartLoadingFallback>
    );
  }, [decimals, maxY, minY]);

  return (
    <StatusDisplay
      label={label}
      color="green"
      value={valueStr}
      overflowElement={chartElement}
    />
  );
});

function useTotalLoadCellValue() {
  const value = useLaunchMachineSelector((state) => {
    const { loadCell1, loadCell2 } = state.context.deviceStates;
    return loadCell1 && loadCell2 ? loadCell1.data + loadCell2.data : 0;
  });
  return { value, valueStr: value.toFixed(2) };
}

const TotalNitrousDisplay = memo(function TotalNitrousDisplay() {
  const { value: totalMassLbs } = useTotalLoadCellValue();

  const vaporPressurePsi = useLaunchMachineSelector(
    (state) =>
      state.context.deviceStates.fsLoxGn2Transducers?.data.oxtank_1_median ?? 0,
  );

  const { liquidMassLbs, vaporMassLbs } = useMemo(
    () => computeNitrousMass(totalMassLbs, vaporPressurePsi),
    [totalMassLbs, vaporPressurePsi],
  );

  return (
    <>
      <StatusDisplay
        label="Liquid Nitrous (lbs)"
        color="green"
        value={liquidMassLbs.toFixed(2)}
      />
      <StatusDisplay
        label="Vapor Nitrous (lbs)"
        color="green"
        value={vaporMassLbs.toFixed(2)}
      />
    </>
  );
});

const AltitudeDisplay = memo(function AltitudeDisplay() {
  const value = useLaunchMachineSelector((state) =>
    (state.context.deviceStates.radioGround?.data.gps_altitude ?? 0).toFixed(1),
  );

  const chartElement = useMemo(() => {
    return (
      <ChartLoadingFallback>
        <StationChart
          // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
          selector={({ radioGround }) =>
            radioGround?.data.gps_altitude != null
              ? {
                  ts: radioGround.ts,
                  value: radioGround.data.gps_altitude,
                }
              : null
          }
          valuePrecision={1}
          minY={0}
          maxY="dataMax + 10"
        />
      </ChartLoadingFallback>
    );
  }, []);

  const [showChart, setShowChart] = useState(false);

  const handleClick = useCallback(() => {
    setShowChart(!showChart);
  }, [showChart]);

  return (
    <StatusDisplay
      label="Altitude (ft)"
      color="green"
      value={value}
      overflowElement={showChart ? chartElement : undefined}
      disabled={false}
      onClick={handleClick}
    />
  );
});

const AccelerationDisplay = memo(function AccelerationDisplay() {
  const G_PER_RAW = 1 / 2140;

  const raw_value = useLaunchMachineSelector(
    (state) => state.context.deviceStates.radioGround?.data.imu_az ?? 0,
  );
  const value = (raw_value * G_PER_RAW).toFixed(3);

  const chartElement = useMemo(() => {
    return (
      <ChartLoadingFallback>
        <StationChart
          // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
          selector={({ radioGround }) =>
            radioGround
              ? {
                  ts: radioGround.ts,
                  value: radioGround.data.imu_az * G_PER_RAW,
                }
              : null
          }
          valuePrecision={3}
          minY="dataMin - 0.2"
          maxY="dataMax + 0.2"
        />
      </ChartLoadingFallback>
    );
  }, [G_PER_RAW]);

  const [showChart, setShowChart] = useState(false);

  const handleClick = useCallback(() => {
    setShowChart(!showChart);
  }, [showChart]);

  return (
    <StatusDisplay
      label="Z Acceleration (Gs)"
      color="green"
      value={value}
      overflowElement={showChart ? chartElement : undefined}
      disabled={false}
      onClick={handleClick}
    />
  );
});

export const StatusPanel = memo(function StatusPanel() {
  const isRecovery = useLaunchMachineSelector(
    (state) => state.context.launchState.activePanel === "recovery",
  );

  return (
    <Panel className="md:min-w-min">
      <p className="mb-4 text-lg text-gray-text">Status</p>
      {isRecovery ? (
        <div className="grid grid-cols-3 gap-4">
          <AltitudeDisplay />
          <AccelerationDisplay />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <StatusDisplayWithChart
            label="Oxtank 1 Median (PSI)"
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
            selector={({ fsLoxGn2Transducers: rec }) =>
              rec && { ts: rec.ts, value: rec.data.oxtank_1_median }
            }
          />
          <StatusDisplayWithChart
            label="Oxtank 2 Median (PSI)"
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
            selector={({ fsLoxGn2Transducers: rec }) =>
              rec && { ts: rec.ts, value: rec.data.oxtank_2_median }
            }
          />
          <StatusDisplayWithChart
            label="COPV 1 Median (PSI)"
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
            selector={({ fsLoxGn2Transducers: rec }) =>
              rec && { ts: rec.ts, value: rec.data.copv_1_median }
            }
          />
          <StatusDisplayWithChart
            label="COPV 2 Median (PSI)"
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
            selector={({ fsLoxGn2Transducers: rec }) =>
              rec && { ts: rec.ts, value: rec.data.copv_2_median }
            }
          />

          <StatusDisplayWithChart
            label="Injector 1 (PSI)"
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
            selector={({ fsInjectorTransducers: rec }) =>
              rec && {
                ts: rec.ts,
                value: rec.data.injector_manifold_1_median ?? 0,
              }
            }
          />
          <StatusDisplayWithChart
            label="Injector 2 (PSI)"
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
            selector={({ fsInjectorTransducers: rec }) =>
              rec && {
                ts: rec.ts,
                value: rec.data.injector_manifold_2_median ?? 0,
              }
            }
          />
          <StatusDisplayWithChart
            label="LOX Temp (°C)"
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
            selector={({ fsThermocouples: rec }) =>
              rec && { ts: rec.ts, value: rec.data.lox_celsius ?? NaN }
            }
          />
          <StatusDisplayWithChart
            label="GN2 Temp (°C)"
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
            selector={({ fsThermocouples: rec }) =>
              rec && { ts: rec.ts, value: rec.data.gn2_celsius ?? NaN }
            }
          />
          <StatusDisplayWithChart
            label="GN2 Surface Temp (°C)"
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
            selector={({ fsThermocouples: rec }) =>
              rec && { ts: rec.ts, value: rec.data.gn2_surface_celsius ?? NaN }
            }
          />
          <StatusDisplayWithChart
            label="Load Cell 1 (lbs)"
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
            selector={({ loadCell1 }) =>
              loadCell1 && { ts: loadCell1.ts, value: loadCell1.data }
            }
            decimals={2}
            minY="dataMin - 2"
            maxY="dataMax + 2"
          />
          <StatusDisplayWithChart
            label="Load Cell 2 (lbs)"
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
            selector={({ loadCell2 }) =>
              loadCell2 && { ts: loadCell2.ts, value: loadCell2.data }
            }
          />
          <StatusDisplayWithChart
            label="Total Load Cell (lbs)"
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
            selector={({ loadCell1, loadCell2 }) =>
              loadCell1 &&
              loadCell2 && {
                ts: (loadCell1.ts + loadCell2.ts) / 2,
                value: loadCell1.data + loadCell2.data,
              }
            }
            decimals={2}
            minY="dataMin - 2"
            maxY="dataMax + 2"
          />

          <TotalNitrousDisplay />
        </div>
      )}
    </Panel>
  );
});
