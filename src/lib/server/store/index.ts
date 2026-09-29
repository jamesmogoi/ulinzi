import "server-only";
import type { Config } from "../config";
import { memoryStore } from "./memory";
import { postgresStore } from "./postgres";
import type { Store } from "./types";

let store: Store | null = null;

export function getStore(config: Config): Store {
  store ??= config.DATABASE_URL ? postgresStore(config.DATABASE_URL) : memoryStore();
  return store;
}
