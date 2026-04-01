/**
 * Prisma seed — populates local dev DB with baseline data.
 * Run: pnpm db:seed
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database…");

  // ── Mock data provider ──────────────────────────────────────
  const mockProvider = await prisma.providerConfig.upsert({
    where: { name: "mock-default" },
    update: {},
    create: {
      id: "provider-mock-001",
      name: "mock-default",
      displayName: "Mock Data Provider",
      providerType: "MOCK",
      isActive: true,
      isDefault: true,
      config: { note: "Returns deterministic fixture data — no credentials required." },
    },
  });
  console.log(`  ✓ Data provider: ${mockProvider.displayName}`);

  // ── Stub LLM provider ───────────────────────────────────────
  const stubLlm = await prisma.llmProviderConfig.upsert({
    where: { name: "stub-default" },
    update: {},
    create: {
      id: "llm-stub-001",
      name: "stub-default",
      displayName: "Stub LLM Provider",
      providerType: "STUB",
      isActive: true,
      isDefault: true,
      config: { simulateLatencyMs: 0, defaultConfidence: "MEDIUM" },
    },
  });
  console.log(`  ✓ LLM provider: ${stubLlm.displayName}`);

  // ── Sample template ─────────────────────────────────────────
  const template = await prisma.template.upsert({
    where: { id: "template-qbr-001" },
    update: {},
    create: {
      id: "template-qbr-001",
      name: "QBR Deck — Standard",
      description: "Quarterly Business Review template for mid-market accounts.",
      googleSlideId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
      googleSlideUrl:
        "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit",
      status: "ACTIVE",
    },
  });
  console.log(`  ✓ Template: ${template.name}`);

  // ── Sample fields ────────────────────────────────────────────
  const fields = [
    { id: "field-001", name: "company_name",    token: "{{COMPANY_NAME}}",    fieldType: "TEXT",    sortOrder: 0 },
    { id: "field-002", name: "arr",             token: "{{ARR}}",             fieldType: "NUMBER",  sortOrder: 1 },
    { id: "field-003", name: "arr_growth",      token: "{{ARR_GROWTH}}",      fieldType: "NUMBER",  sortOrder: 2 },
    { id: "field-004", name: "nrr",             token: "{{NRR}}",             fieldType: "NUMBER",  sortOrder: 3 },
    { id: "field-005", name: "health_score",    token: "{{HEALTH_SCORE}}",    fieldType: "JUDGMENT",sortOrder: 4 },
    { id: "field-006", name: "is_at_risk",      token: "{{IS_AT_RISK}}",      fieldType: "BOOLEAN", sortOrder: 5 },
    { id: "field-007", name: "champion_name",   token: "{{CHAMPION_NAME}}",   fieldType: "TEXT",    sortOrder: 6 },
    { id: "field-008", name: "champion_title",  token: "{{CHAMPION_TITLE}}",  fieldType: "TEXT",    sortOrder: 7 },
    { id: "field-009", name: "contract_end",    token: "{{CONTRACT_END}}",    fieldType: "DATE",    sortOrder: 8 },
  ] as const;

  for (const f of fields) {
    await prisma.templateField.upsert({
      where: { id: f.id },
      update: {},
      create: {
        ...f,
        templateId: template.id,
        required: true,
        fieldType: f.fieldType,
      },
    });
  }
  console.log(`  ✓ ${fields.length} template fields`);

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
