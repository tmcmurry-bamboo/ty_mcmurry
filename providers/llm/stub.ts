/**
 * Stub LLM provider — returns deterministic fixture results.
 * Used in development and tests when no real LLM is configured.
 */

import type {
  LlmProvider,
  LlmProviderMetadata,
  ClassifyFieldResult,
  ClassifyFieldContext,
  GenerateNarrativeResult,
  EvaluateJudgmentResult,
  ProviderConnectionResult,
  NarrativeOptions,
  JudgmentOptions,
} from "@/types/providers";

const META: LlmProviderMetadata = {
  name: "stub",
  displayName: "Stub LLM Provider",
  providerType: "STUB",
  model: "stub-v1",
  capabilities: ["FIELD_CLASSIFICATION", "NARRATIVE_GENERATION", "JUDGMENT_EVALUATION", "FIELD_TYPE_SUGGESTION"],
};

export class StubLlmProvider implements LlmProvider {
  readonly metadata: LlmProviderMetadata = META;

  async validateProviderConnection(): Promise<ProviderConnectionResult> {
    return { success: true, latencyMs: 0, message: "Stub LLM is always connected" };
  }

  async classifyField(
    fieldName: string,
    _context?: ClassifyFieldContext
  ): Promise<ClassifyFieldResult> {
    const lower = fieldName.toLowerCase();
    const isBoolean = ["is_", "has_", "was_", "can_", "will_"].some((p) => lower.startsWith(p));
    const isJudgment = ["score", "health", "risk", "status", "quality", "sentiment"].some((k) =>
      lower.includes(k)
    );

    return {
      fieldName,
      suggestedType: isBoolean ? "BOOLEAN" : isJudgment ? "JUDGMENT" : "TEXT",
      confidence: "MEDIUM",
      reasoning: `Stub classification for field "${fieldName}"`,
      isJudgmentField: isJudgment,
      judgmentType: isJudgment ? "HEALTH" : undefined,
    };
  }

  async generateNarrative(
    prompt: string,
    _context: Record<string, unknown>,
    _options?: NarrativeOptions
  ): Promise<GenerateNarrativeResult> {
    return {
      narrative: `[STUB] Narrative for prompt: "${prompt.slice(0, 80)}…"`,
      tokensUsed: 0,
      model: "stub-v1",
    };
  }

  async evaluateJudgment(
    fieldName: string,
    value: unknown,
    _criteria: string[],
    _options?: JudgmentOptions
  ): Promise<EvaluateJudgmentResult> {
    const numValue = typeof value === "number" ? value : 50;
    return {
      fieldName,
      score: numValue,
      label: numValue >= 70 ? "Good" : numValue >= 40 ? "Needs Attention" : "At Risk",
      reasoning: `Stub evaluation for field "${fieldName}" with value ${value}`,
      confidence: "LOW",
    };
  }
}
