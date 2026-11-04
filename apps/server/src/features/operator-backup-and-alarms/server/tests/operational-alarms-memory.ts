import type {
  AlarmNotifierPort,
  AlarmStorePort,
  OperationalAlarm,
  OperationalErrorRecord,
} from "../operational-alarms";
import { createExternalAccessGate } from "../restore-access-gate";

/** In-memory Better Stack double, alarm store, gate and injected clock. */
export function createAlarmWorld(start = "2026-11-02T10:00:00.000Z") {
  let nowMs = Date.parse(start);
  let counter = 0;
  const { controller, gate } = createExternalAccessGate({
    open: true,
    reason: "normal-operation",
  });
  const delivered: OperationalAlarm[] = [];
  const alarms: OperationalAlarm[] = [];
  const errors: OperationalErrorRecord[] = [];
  const faults: { deliveryDelayMs: number; deliveryFails: boolean } = {
    deliveryDelayMs: 0,
    deliveryFails: false,
  };

  const notifier: AlarmNotifierPort = {
    raise(alarm) {
      nowMs += faults.deliveryDelayMs;
      if (faults.deliveryFails) {
        return Promise.reject(new Error("better stack down"));
      }
      delivered.push(alarm);
      return Promise.resolve();
    },
  };
  const store: AlarmStorePort = {
    saveAlarm(alarm) {
      alarms.push(alarm);
      return Promise.resolve();
    },
    saveOperationalError(error) {
      errors.push(error);
      return Promise.resolve();
    },
  };

  return {
    advance(ms: number) {
      nowMs += ms;
    },
    alarms,
    controller,
    delivered,
    errors,
    faults,
    gate,
    newAlarmId: () => {
      counter += 1;
      return `alarm-${counter}`;
    },
    notifier,
    now: () => new Date(nowMs),
    store,
  };
}
