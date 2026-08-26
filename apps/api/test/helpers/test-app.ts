import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../../src/app.module";
import { AllExceptionsFilter } from "../../src/common/all-exceptions.filter";

// Boots the REAL application graph (every module, guard, and controller
// exactly as main.ts assembles it) against whatever DATABASE_URL/REDIS_URL
// point at — a real, disposable Postgres + Redis in CI (see
// .github/workflows/ci.yml's api-e2e-tests job), or a local `docker
// compose up -d postgres redis` for running this file by hand. This is
// deliberately NOT a unit test with mocked providers: the whole point of
// this suite is proving the wiring between guards/services/RLS/Redis
// actually works end-to-end, which a mocked test cannot prove.
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}
