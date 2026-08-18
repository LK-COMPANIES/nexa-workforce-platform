import { Injectable } from "@nestjs/common";
import { loadApiEnv, type ApiEnv } from "@nexa/config";

@Injectable()
export class ApiConfigService {
  readonly env: ApiEnv;

  constructor() {
    // Throws with an aggregated, readable error if any required variable is
    // missing or invalid — the process must never start with incomplete
    // production configuration (see packages/config/src/env.ts).
    this.env = loadApiEnv();
  }
}
