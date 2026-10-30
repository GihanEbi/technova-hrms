// Typed mock service layer. Wraps synchronous store mutations in a short,
// simulated network delay so forms and buttons show realistic loading states.
import { useHRStore } from "@/store/hr-store";

const LATENCY_MS = 350;

export function simulate<T>(fn: () => T, ms = LATENCY_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(fn());
      } catch (err) {
        reject(err);
      }
    }, ms);
  });
}

/** Direct access to store actions for use inside event handlers. */
export const api = () => useHRStore.getState();
