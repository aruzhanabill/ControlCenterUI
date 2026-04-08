import { memo, useMemo } from "react";
import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SIGNAL_METADATA, useTelemetryStore } from "@/stores/telemetryStore";

import { PulseFill } from "./PulseFill";

const SECONDARY_DASH = "6 3";
const FILL_LEVEL_DOMAIN: [number, number] = [0, 100];

const COPV_CONFIG = {
  title: "COPV Pressure",
  signals: ["copv_1_psi", "copv_2_psi"] as const,
  unit: "PSI",
  height: 200,
};

const OXTANK_CONFIG = {
  title: "Oxtank Pressure",
  signals: ["oxtank_1_psi", "oxtank_2_psi"] as const,
  unit: "PSI",
  height: 200,
};

const MULTI_SIGNAL_CONFIGS = [
  {
    title: "Temperature",
    signals: [
      "gn2_internal_temp_c",
      "gn2_external_temp_c",
      "lox_upper_temp_c",
      "lox_lower_temp_c",
      "cap_fill_board_temp_c",
    ] as const,
    unit: "°C",
    height: 250,
  },
  {
    title: "Load Cells",
    signals: ["load_cell_1_lbs", "load_cell_2_lbs"] as const,
    unit: "lbs",
    height: 200,
  },
] as const;

const TIME_RANGE_SECONDS = 120;

const X_AXIS_TICK_STYLE = { fontSize: 10 } as const;
const X_AXIS_LABEL = {
  value: "Time (s)",
  position: "insideBottom",
  offset: -5,
  fontSize: 10,
} as const;
const Y_AXIS_TICK_STYLE = { fontSize: 10 } as const;

const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: "#fff",
  border: "1px solid #ccc",
  borderRadius: "4px",
  fontSize: "11px",
} as const;

const LEGEND_WRAPPER_STYLE = { fontSize: "10px" } as const;

const fillLevelTooltipFormatter = (value: number) => `${value.toFixed(1)} %`;

const capBaseTooltipFormatter = (value: number) => `${value.toFixed(3)} pF`;

type PressureConfig = typeof COPV_CONFIG | typeof OXTANK_CONFIG;

const PressurePlot = memo(function PressurePlot({
  config,
}: {
  config: PressureConfig;
}) {
  const store = useTelemetryStore();

  const { chartData, latestValues } = useMemo(() => {
    const now = Date.now() * 1000;
    const startTime = now - TIME_RANGE_SECONDS * 1e6;

    const allSamples = config.signals.map((signal) =>
      store.getSamples(signal, startTime, now),
    );

    const timestamps = new Set<number>();
    allSamples.forEach((samples) =>
      samples.forEach((s) => timestamps.add(s.timestamp)),
    );

    const sortedTimestamps = Array.from(timestamps).sort((a, b) => a - b);

    const data = sortedTimestamps.map((timestamp) => {
      const dataPoint: Record<string, number> = {
        time: (timestamp - now) / 1e6,
      };
      config.signals.forEach((signal, idx) => {
        const sample = allSamples[idx].find((s) => s.timestamp === timestamp);
        if (sample) dataPoint[signal] = sample.value;
      });
      return dataPoint;
    });

    const last = data[data.length - 1] ?? {};
    const latest: Record<string, number | null> = {};
    config.signals.forEach((signal) => {
      latest[signal] = last[signal] ?? null;
    });

    return { chartData: data, latestValues: latest };
  }, [config.signals, store]);

  const hasData = chartData.length > 0;
  const accentColor = SIGNAL_METADATA[config.signals[0]].color;

  return (
    <div className="p-3 border rounded-lg bg-gray-bg-1 border-gray-border">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-gray-text">{config.title}</h3>
        <span className="text-xs text-gray-text-dim">{config.unit}</span>
      </div>

      {!hasData && (
        <div
          style={{ height: `${config.height}px` }}
          className="flex items-center justify-center text-xs text-gray-text-dim"
        >
          Waiting for data...
        </div>
      )}

      {hasData && (
        <>
          <div className="flex" style={{ gap: 0, alignItems: "stretch" }}>
            <div style={{ flex: 1, minWidth: 0, height: `${config.height}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="time"
                    stroke="#666"
                    tick={X_AXIS_TICK_STYLE}
                    tickCount={3}
                    label={X_AXIS_LABEL}
                  />
                  <YAxis
                    stroke="#666"
                    tick={Y_AXIS_TICK_STYLE}
                    tickCount={5}
                    width={45}
                  />
                  <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} />
                  <Legend
                    wrapperStyle={LEGEND_WRAPPER_STYLE}
                    align="left"
                    verticalAlign="top"
                    layout="vertical"
                    iconType="line"
                  />
                  {config.signals.map((signal, idx) => {
                    const dash = idx === 1 ? SECONDARY_DASH : undefined;
                    return (
                      <Line
                        key={signal}
                        type="monotone"
                        dataKey={signal}
                        name={SIGNAL_METADATA[signal].label}
                        stroke={SIGNAL_METADATA[signal].color}
                        strokeWidth={2}
                        strokeDasharray={dash}
                        dot={false}
                        isAnimationActive={false}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div
              className="flex flex-col justify-center border-l gap-3 border-gray-border"
              style={{ paddingLeft: 14, marginLeft: 10, minWidth: 96 }}
            >
              {config.signals.map((signal) => {
                const val = latestValues[signal];
                return (
                  <div key={signal} className="flex flex-col items-end">
                    <div className="flex items-center gap-1">
                      <svg width="16" height="8" style={{ flexShrink: 0 }}>
                        {signal === config.signals[1] ? (
                          <line
                            x1="0"
                            y1="4"
                            x2="16"
                            y2="4"
                            stroke={accentColor}
                            strokeWidth="2"
                            strokeDasharray="4 2"
                          />
                        ) : (
                          <line
                            x1="0"
                            y1="4"
                            x2="16"
                            y2="4"
                            stroke={accentColor}
                            strokeWidth="2"
                          />
                        )}
                      </svg>
                      <span className="text-xs text-gray-text-dim">
                        {SIGNAL_METADATA[signal].label}
                      </span>
                    </div>
                    <span
                      className="font-mono font-semibold tabular-nums"
                      style={{
                        fontSize: "1.6rem",
                        lineHeight: 1.1,
                        color: accentColor,
                      }}
                    >
                      {val !== null ? val.toFixed(0) : "--"}
                    </span>
                    <span className="text-xs text-gray-text-dim">PSI</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap pt-2 mt-2 border-t gap-3 border-gray-border">
            {config.signals.map((signal) => {
              const val = latestValues[signal];
              return (
                <div key={signal} className="flex items-baseline gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: accentColor }}
                  />
                  <span className="text-xs text-gray-text-dim">
                    {SIGNAL_METADATA[signal].label}:
                  </span>
                  <span className="font-mono text-xs font-semibold text-gray-text tabular-nums">
                    {val !== null ? val.toFixed(1) : "--"}
                  </span>
                  <span className="text-xs text-gray-text-dim">PSI</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
});

type MultiSignalConfig = (typeof MULTI_SIGNAL_CONFIGS)[number];

const MultiSignalPlot = memo(function MultiSignalPlot({
  config,
}: {
  config: MultiSignalConfig;
}) {
  const store = useTelemetryStore();

  const chartData = useMemo(() => {
    const now = Date.now() * 1000;
    const startTime = now - TIME_RANGE_SECONDS * 1e6;

    const allSamples = config.signals.map((signal) =>
      store.getSamples(signal, startTime, now),
    );

    const timestamps = new Set<number>();
    allSamples.forEach((samples) =>
      samples.forEach((s) => timestamps.add(s.timestamp)),
    );

    const sortedTimestamps = Array.from(timestamps).sort((a, b) => a - b);

    return sortedTimestamps.map((timestamp) => {
      const dataPoint: Record<string, number> = {
        time: (timestamp - now) / 1e6,
      };
      config.signals.forEach((signal, idx) => {
        const sample = allSamples[idx].find((s) => s.timestamp === timestamp);
        if (sample) dataPoint[signal] = sample.value;
      });
      return dataPoint;
    });
  }, [config.signals, store]);

  const hasData = chartData.length > 0;

  return (
    <div
      className="p-3 border rounded-lg bg-gray-bg-1 border-gray-border"
      style={{ height: `${config.height + 80}px` }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-gray-text">{config.title}</h3>
        <span className="text-xs text-gray-text-dim">{config.unit}</span>
      </div>

      {!hasData && (
        <div
          style={{ height: `${config.height}px` }}
          className="flex items-center justify-center text-xs text-gray-text-dim"
        >
          Waiting for data...
        </div>
      )}

      {hasData && (
        <>
          <div style={{ height: `${config.height}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis
                  dataKey="time"
                  stroke="#666"
                  tick={X_AXIS_TICK_STYLE}
                  tickCount={3}
                  label={X_AXIS_LABEL}
                />
                <YAxis
                  stroke="#666"
                  tick={Y_AXIS_TICK_STYLE}
                  tickCount={5}
                  width={45}
                />
                <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} />
                <Legend
                  wrapperStyle={LEGEND_WRAPPER_STYLE}
                  align="left"
                  verticalAlign="top"
                  layout="vertical"
                  iconType="line"
                />
                {config.signals.map((signal) => (
                  <Line
                    key={signal}
                    type="monotone"
                    dataKey={signal}
                    name={SIGNAL_METADATA[signal].label}
                    stroke={SIGNAL_METADATA[signal].color}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap pt-2 mt-2 border-t gap-3 border-gray-border">
            {config.signals.map((signal) => {
              const latestValue =
                chartData.length > 0
                  ? chartData[chartData.length - 1][signal]
                  : null;
              return (
                <div key={signal} className="flex items-baseline gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: SIGNAL_METADATA[signal].color }}
                  />
                  <span className="text-xs text-gray-text-dim">
                    {SIGNAL_METADATA[signal].label}:
                  </span>
                  <span className="font-mono text-xs font-semibold text-gray-text tabular-nums">
                    {latestValue !== null && latestValue !== undefined
                      ? latestValue.toFixed(1)
                      : "--"}
                  </span>
                  <span className="text-xs text-gray-text-dim">
                    {config.unit}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
});

const FillLevelPlot = memo(function FillLevelPlot() {
  const store = useTelemetryStore();

  const { chartData, latestValue } = useMemo(() => {
    const now = Date.now() * 1000;
    const startTime = now - TIME_RANGE_SECONDS * 1e6;

    const samples = store.getSamples("cap_fill_actual", startTime, now);
    const data = samples.map((s) => ({
      time: (s.timestamp - now) / 1e6,
      cap_fill_actual: s.value,
    }));

    const latest =
      data.length > 0 ? data[data.length - 1].cap_fill_actual : null;

    return { chartData: data, latestValue: latest };
  }, [store]);

  const hasData = chartData.length > 0;

  return (
    <div className="p-3 border rounded-lg bg-gray-bg-1 border-gray-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-text">
          Cap Fill Actual
        </span>
        <span className="text-xs text-gray-text-dim">%</span>
      </div>

      {!hasData && (
        <div
          style={{ height: "160px" }}
          className="flex items-center justify-center text-xs text-gray-text-dim"
        >
          Waiting for data...
        </div>
      )}

      {hasData && (
        <>
          <div style={{ height: "160px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis
                  dataKey="time"
                  stroke="#666"
                  tick={X_AXIS_TICK_STYLE}
                  tickCount={4}
                  label={X_AXIS_LABEL}
                />
                <YAxis
                  stroke="#666"
                  tick={Y_AXIS_TICK_STYLE}
                  tickCount={5}
                  width={40}
                  domain={FILL_LEVEL_DOMAIN}
                />
                <Tooltip
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  formatter={fillLevelTooltipFormatter}
                />
                <Line
                  type="monotone"
                  dataKey="cap_fill_actual"
                  name={SIGNAL_METADATA["cap_fill_actual"].label}
                  stroke={SIGNAL_METADATA["cap_fill_actual"].color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap pt-2 mt-2 border-t gap-3 border-gray-border">
            <div className="flex items-baseline gap-1.5">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: SIGNAL_METADATA["cap_fill_actual"].color,
                }}
              />
              <span className="text-xs text-gray-text-dim">
                Cap fill actual:
              </span>
              <span className="font-mono text-xs font-semibold text-gray-text tabular-nums">
                {latestValue !== null ? latestValue.toFixed(1) : "--"}
              </span>
              <span className="text-xs text-gray-text-dim">%</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

const CapBasePlot = memo(function CapBasePlot() {
  const store = useTelemetryStore();

  const { chartData, latestValue } = useMemo(() => {
    const now = Date.now() * 1000;
    const startTime = now - TIME_RANGE_SECONDS * 1e6;

    const samples = store.getSamples("cap_fill_base", startTime, now);
    const data = samples.map((s) => ({
      time: (s.timestamp - now) / 1e6,
      cap_fill_base: s.value,
    }));

    const latest = data.length > 0 ? data[data.length - 1].cap_fill_base : null;

    return { chartData: data, latestValue: latest };
  }, [store]);

  const hasData = chartData.length > 0;

  return (
    <div className="p-3 border rounded-lg bg-gray-bg-1 border-gray-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-text">Cap base</span>
        <span className="text-xs text-gray-text-dim">pF</span>
      </div>

      {!hasData && (
        <div
          style={{ height: "160px" }}
          className="flex items-center justify-center text-xs text-gray-text-dim"
        >
          Waiting for data...
        </div>
      )}

      {hasData && (
        <>
          <div style={{ height: "160px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis
                  dataKey="time"
                  stroke="#666"
                  tick={X_AXIS_TICK_STYLE}
                  tickCount={4}
                  label={X_AXIS_LABEL}
                />
                <YAxis
                  stroke="#666"
                  tick={Y_AXIS_TICK_STYLE}
                  tickCount={5}
                  width={50}
                />
                <Tooltip
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  formatter={capBaseTooltipFormatter}
                />
                <Line
                  type="monotone"
                  dataKey="cap_fill_base"
                  name={SIGNAL_METADATA["cap_fill_base"].label}
                  stroke={SIGNAL_METADATA["cap_fill_base"].color}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap pt-2 mt-2 border-t gap-3 border-gray-border">
            <div className="flex items-baseline gap-1.5">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: SIGNAL_METADATA["cap_fill_base"].color,
                }}
              />
              <span className="text-xs text-gray-text-dim">Cap base:</span>
              <span className="font-mono text-xs font-semibold text-gray-text tabular-nums">
                {latestValue !== null ? latestValue.toFixed(3) : "--"}
              </span>
              <span className="text-xs text-gray-text-dim">pF</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

export const FixedPlotsPanel = memo(function FixedPlotsPanel() {
  return (
    <div className="flex flex-col h-full border bg-gray-el-bg rounded-xl border-gray-border">
      <div className="p-3 border-b border-gray-border">
        <h2 className="text-xs font-bold tracking-widest uppercase text-gray-text">
          Live Telemetry
        </h2>
      </div>

      <div className="p-3 overflow-y-scroll" style={{ flex: "1 1 0px" }}>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-3">
            <PressurePlot config={COPV_CONFIG} />
            <PulseFill />
            <MultiSignalPlot config={MULTI_SIGNAL_CONFIGS[1]} />
          </div>
          <div className="flex flex-col gap-3">
            <PressurePlot config={OXTANK_CONFIG} />
            <MultiSignalPlot config={MULTI_SIGNAL_CONFIGS[0]} />
          </div>
        </div>

        <div className="flex mt-3 gap-3">
          <div style={{ flex: "1 1 0" }}>
            <FillLevelPlot />
          </div>
          <div style={{ flex: "1 1 0" }}>
            <CapBasePlot />
          </div>
        </div>
      </div>
    </div>
  );
});
