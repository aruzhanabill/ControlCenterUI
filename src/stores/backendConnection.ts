import { type DeviceStates } from "@/machines/launchMachine";

import { useTelemetryStore } from "./telemetryStore";

class BackendConnectionManager {
  private intervalId: NodeJS.Timeout | null = null;
  private deviceStatesCallback: (() => DeviceStates) | null = null;

  start(getDeviceStates: () => DeviceStates) {
    if (this.intervalId) {
      console.warn("BackendConnection already started");
      return;
    }

    this.deviceStatesCallback = getDeviceStates;

    this.intervalId = setInterval(() => {
      if (!this.deviceStatesCallback) return;

      const deviceStates = this.deviceStatesCallback();
      const timestamp = Date.now() * 1000; // ms

      this.processDeviceStates(deviceStates, timestamp);
    }, 100);

    console.log("BackendConnection started (100ms poll)");
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.deviceStatesCallback = null;
      console.log("BackendConnection stopped");
    }
  }

  isConnected(): boolean {
    return this.intervalId !== null;
  }

  private processDeviceStates(deviceStates: DeviceStates, timestamp: number) {
    console.log("loadCell1:", deviceStates.loadCell1);
    console.log("loadCell2:", deviceStates.loadCell2);

    const store = useTelemetryStore.getState();

    if (deviceStates.fsLoxGn2Transducers) {
      const data = deviceStates.fsLoxGn2Transducers.data;

      store.appendSample("oxtank_1_psi", {
        timestamp,
        value: data.oxtank_1,
      });

      store.appendSample("oxtank_2_psi", {
        timestamp,
        value: data.oxtank_2,
      });

      store.appendSample("copv_1_psi", {
        timestamp,
        value: data.copv_1,
      });

      store.appendSample("copv_2_psi", {
        timestamp,
        value: data.copv_2,
      });

      store.appendSample("pilot_pres_psi", {
        timestamp,
        value: data.pilot_pres,
      });

      store.appendSample("qd_pres_psi", {
        timestamp,
        value: data.qd_pres,
      });
    }

    if (deviceStates.fsInjectorTransducers) {
      const data = deviceStates.fsInjectorTransducers.data;

      store.appendSample("injector_1_psi", {
        timestamp,
        value: data.injector_1,
      });

      store.appendSample("injector_2_psi", {
        timestamp,
        value: data.injector_2,
      });

      store.appendSample("upper_cc_psi", {
        timestamp,
        value: data.upper_cc,
      });
    }

    if (deviceStates.fsThermocouples) {
      const data = deviceStates.fsThermocouples.data;

      store.appendSample("gn2_internal_temp_c", {
        timestamp,
        value: data.gn2_internal_celsius,
      });

      store.appendSample("gn2_external_temp_c", {
        timestamp,
        value: data.gn2_external_celsius,
      });

      store.appendSample("lox_upper_temp_c", {
        timestamp,
        value: data.lox_upper_celsius,
      });

      store.appendSample("lox_lower_temp_c", {
        timestamp,
        value: data.lox_lower_celsius,
      });
    }

    if (deviceStates.loadCell1) {
      store.appendSample("load_cell_1_lbs", {
        timestamp,
        value: deviceStates.loadCell1.data,
      });
    }

    if (deviceStates.loadCell2) {
      store.appendSample("load_cell_2_lbs", {
        timestamp,
        value: deviceStates.loadCell2.data,
      });
    }

    if (deviceStates.loadCell1 && deviceStates.loadCell2) {
      const totalLoad =
        deviceStates.loadCell1.data + deviceStates.loadCell2.data;
      store.appendSample("total_load_lbs", {
        timestamp,
        value: totalLoad,
      });
    }

    if (deviceStates.radioGround) {
      const data = deviceStates.radioGround.data;

      store.appendSample("altitude_ft", {
        timestamp,
        value: data.gps_altitude * 3.28084,
      });

      const G_PER_RAW = 1 / 2140;
      store.appendSample("acceleration_g", {
        timestamp,
        value: data.imu_az * G_PER_RAW,
      });
    }

    if (deviceStates.relayCurrentMonitor) {
      const data = deviceStates.relayCurrentMonitor.data;

      const totalCurrent =
        data.gn2_drain_ma +
        data.gn2_fill_ma +
        data.depress_ma +
        data.press_pilot_ma +
        data.run_ma +
        data.lox_fill_ma +
        data.lox_disconnect_ma +
        data.igniter_ma;

      store.appendSample("total_relay_current_ma", {
        timestamp,
        value: totalCurrent,
      });

      store.appendSample("gn2_drain_current_ma", {
        timestamp,
        value: data.gn2_drain_ma,
      });

      store.appendSample("gn2_fill_current_ma", {
        timestamp,
        value: data.gn2_fill_ma,
      });

      store.appendSample("igniter_current_ma", {
        timestamp,
        value: data.igniter_ma,
      });
    }

    if (deviceStates.capFill) {
      const { data } = deviceStates.capFill;
      store.appendSample("cap_fill_actual", {
        timestamp,
        value: data.cap_fill_actual,
      });
      store.appendSample("cap_fill_base", {
        timestamp,
        value: data.cap_fill_base,
      });
      store.appendSample("cap_fill_board_temp_c", {
        timestamp,
        value: data.board_temp,
      });
    }

    store.setConnected(true);
  }
}

export const backendConnection = new BackendConnectionManager();
