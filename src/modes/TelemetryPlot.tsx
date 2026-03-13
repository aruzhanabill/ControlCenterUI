import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  type PlotConfig,
  SIGNAL_METADATA,
  useTelemetryStore,
} from "@/stores/telemetryStore";

interface Props {
  plotConfig: PlotConfig;
}

export const TelemetryPlot = memo(function TelemetryPlot({
  plotConfig,
}: Props) {
  const { signal, timeRange, paused, id } = plotConfig;

  const updateTimeRange = useTelemetryStore(
    (state) => state.updatePlotTimeRange,
  );
  const togglePause = useTelemetryStore((state) => state.togglePlotPause);
  const getSamples = useTelemetryStore((state) => state.getSamples);

  const metadata = SIGNAL_METADATA[signal];

  // Track the timestamp when pause was activated
  const pausedTimestampRef = useRef<number | null>(null);

  // Force re-renders when live to show fresh data
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (paused) return;

    // Update every 100ms when live
    const interval = setInterval(() => {
      forceUpdate((n) => n + 1);
    }, 100);

    return () => clearInterval(interval);
  }, [paused]);

  useEffect(() => {
    if (paused && pausedTimestampRef.current === null) {
      // Capture timestamp when pausing
      pausedTimestampRef.current = Date.now() * 1000;
    } else if (!paused) {
      // Clear when unpausing
      pausedTimestampRef.current = null;
    }
  }, [paused]);

  // Use frozen timestamp when paused, current time when live
  const now =
    paused && pausedTimestampRef.current !== null
      ? pausedTimestampRef.current
      : Date.now() * 1000;

  const tstart = now - timeRange * 1e6;
  const tend = now;

  const samples = getSamples(signal, tstart, tend);

  const plotData = samples.map((sample) => ({
    time: (sample.timestamp - now) / 1e6,
    value: sample.value,
  }));

  const handleTimeRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateTimeRange(id, Number(e.target.value));
    },
    [id, updateTimeRange],
  );

  const handleTogglePause = useCallback(() => {
    togglePause(id);
  }, [id, togglePause]);

  const chartMargin = useMemo(
    () => ({ top: 5, right: 10, left: 0, bottom: 5 }),
    [],
  );
  const xAxisTick = useMemo(() => ({ fill: "#64748b", fontSize: 11 }), []);
  const yAxisTick = useMemo(() => ({ fill: "#64748b", fontSize: 11 }), []);
  const tooltipContentStyle = useMemo(
    () => ({
      backgroundColor: "#ffffff",
      border: "1px solid #e2e8f0",
      borderRadius: "8px",
      fontSize: "12px",
    }),
    [],
  );
  const tooltipLabelStyle = useMemo(() => ({ color: "#475569" }), []);

  const tickFormatter = useCallback((val: number) => `${val.toFixed(0)}s`, []);
  const tooltipFormatter = useCallback(
    (value: number) => [value.toFixed(2), metadata.unit],
    [metadata.unit],
  );
  const labelFormatter = useCallback(
    (label: number) => `${label.toFixed(1)}s ago`,
    [],
  );

  return (
    <div className="p-4 border rounded-lg bg-gray-el-bg border-gray-border">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center flex-1 min-w-0 gap-3">
          <div
            className="flex-shrink-0 w-3 h-3 rounded-full"
            style={{ backgroundColor: metadata.color }}
          />
          <h3 className="font-semibold truncate text-gray-text-dim">
            {metadata.label} ({metadata.unit})
          </h3>
        </div>

        <div className="flex items-center flex-shrink-0 gap-2">
          <select
            value={timeRange}
            onChange={handleTimeRangeChange}
            className="px-2 py-1 text-xs bg-white border rounded-lg border-gray-border text-gray-text"
          >
            <option value={30}>30s</option>
            <option value={60}>1m</option>
            <option value={120}>2m</option>
            <option value={300}>5m</option>
            <option value={600}>10m</option>
            <option value={1200}>20m</option>
          </select>

          <button
            onClick={handleTogglePause}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              paused
                ? "bg-yellow-solid hover:bg-yellow-solid-hover text-white"
                : "bg-green-solid hover:bg-green-solid-hover text-white"
            }`}
          >
            {paused ? "RESUME" : "PAUSE"}
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={plotData} margin={chartMargin}>
          <XAxis
            dataKey="time"
            stroke="#94a3b8"
            tick={xAxisTick}
            tickFormatter={tickFormatter}
          />
          <YAxis stroke="#94a3b8" tick={yAxisTick} width={60} />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            formatter={tooltipFormatter}
            labelFormatter={labelFormatter}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={metadata.color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex items-center mt-2 text-xs gap-4 text-gray-text-dim">
        <div>Points: {plotData.length}</div>
        {plotData.length > 0 && (
          <>
            <div>
              Latest: {plotData[plotData.length - 1]?.value.toFixed(2) || "--"}{" "}
              {metadata.unit}
            </div>
            <div>
              Min: {Math.min(...plotData.map((d) => d.value)).toFixed(2)}{" "}
              {metadata.unit}
            </div>
            <div>
              Max: {Math.max(...plotData.map((d) => d.value)).toFixed(2)}{" "}
              {metadata.unit}
            </div>
          </>
        )}
      </div>
    </div>
  );
});
