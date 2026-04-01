/**
 * OpenAI LLM provider — Phase 3 implementation stub.
 *
 * STUB: validateProviderConnection performs a real API ping.
 * Full chat completion calls implemented in Phase 3.
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
  OpenAiProviderConfig,
} from "@/types/providers";
import { LlmProviderError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export class OpenAiProvider implements LlmProvider {
  private readonly config: OpenAiProviderConfig;

  readonly metadata: LlmProviderMetadata;

  constructor(config: Record<string, unknown>) {
    this.config = config as unknown as OpenAiProviderConfig;
    this.metadata = {
      name: "openai",
      displayName: "OpenAI",
      providerType: "OPENAI",
      model: this.config.model ?? "gpt-4o-mini",
      capabilities: [
        "FIELD_CLASSIFICATION",
        "NARRATIVE_GENERATION",
        "JUDGMENT_EVALUATION",
        "FIELD_TYPE_SUGGESTION",
      ],
    };
  }

  private getApiKey(): string {
    const key = process.env[this.config.apiKeyRef];
    if (!key) {
      throw new LlmProviderError(
        "openai",
        `OpenAI API key not found in environment variable "${this.config.apiKeyRef}"`
      );
    }
    return key;
  }

  async validateProviderConnection(): Promise<ProviderConnectionResult> {
    const start = Date.now();
    try {
      const apiKey = this.getApiKey();
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return {
        success: res.ok,
        latencyMs: Date.now() - start,
        message: res.ok ? "OpenAI connection successful" : `HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : "Connection failed",
      };
    }
  }

  private async chat(
    messages: { role: "system" | "user"; content: string }[],
    options?: { timeoutMs?: number }
  ): Promise<{ content: string; tokensUsed: number }> {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({
      apiKey: this.getApiKey(),
      ...(this.config.orgId ? { organization: this.config.orgId } : {}),
      timeout: options?.timeoutMs ?? this.config.timeoutMs ?? 30000,
    });

    const completion = await client.chat.completions.create({
      model: this.config.model ?? "gpt-4o-mini",
      messages,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const tokensUsed = completion.usage?.total_tokens ?? 0;
    return { content, tokensUsed };
  }

  async classifyField(
    fieldName: string,
    context?: ClassifyFieldContext
  ): Promise<ClassifyFieldResult> {
    logger.info({ fieldName }, "OpenAiProvider.classifyField");
    try {
      const { content } = await this.chat([
        {
          role: "system",
          content:
            "You are a data field classifier for a B2B SaaS analytics platform. " +
            "Return valid JSON with fields: suggestedType (TEXT|NUMBER|DATE|BOOLEAN|JUDGMENT|NARRATIVE), " +
            "confidence (HIGH|MEDIUM|LOW), reasoning (string), isJudgmentField (boolean), judgmentType (string|null).",
        },
        {
          role: "user",
          content:
            `Field name: "${fieldName}"\n` +
            (context?.token ? `Token: "${context.token}"\n` : "") +
            (context?.templateName ? `Template: "${context.templateName}"\n` : "") +
            (context?.existingFields?.length
              ? `Other fields in template: ${context.existingFields.slice(0, 10).join(", ")}\n`
              : "") +
            "Classify this field and return the JSON.",
        },
      ]);

      const parsed = JSON.parse(content);
      return {
        fieldName,
        suggestedType: parsed.suggestedType ?? "TEXT",
        confidence: parsed.confidence ?? "MEDIUM",
        reasoning: parsed.reasoning ?? "",
        isJudgmentField: parsed.isJudgmentField ?? false,
        judgmentType: parsed.judgmentType ?? undefined,
      };
    } catch (err) {
      throw new LlmProviderError("openai", err instanceof Error ? err.message : "classifyField failed");
    }
  }

  async generateNarrative(
    prompt: string,
    context: Record<string, unknown>,
    options?: NarrativeOptions
  ): Promise<GenerateNarrativeResult> {
    logger.info({ promptLength: prompt.length }, "OpenAiProvider.generateNarrative");
    try {
      const systemMsg =
        "You are a professional business writer generating narrative content for executive presentations. " +
        `Tone: ${options?.tone ?? "professional"}. ` +
        (options?.maxLength ? `Max length: ${options.maxLength} characters. ` : "") +
        "Return valid JSON with field: narrative (string).";

      const userMsg =
        `Prompt: ${prompt}\n\nData context:\n${JSON.stringify(context, null, 2)}`;

      const { content, tokensUsed } = await this.chat([
        { role: "system", content: systemMsg },
        { role: "user", content: userMsg },
      ], { timeoutMs: options ? undefined : 45000 });

      const parsed = JSON.parse(content);
      return {
        narrative: parsed.narrative ?? "",
        tokensUsed,
        model: this.config.model ?? "gpt-4o-mini",
      };
    } catch (err) {
      throw new LlmProviderError("openai", err instanceof Error ? err.message : "generateNarrative failed");
    }
  }

  async evaluateJudgment(
    fieldName: string,
    value: unknown,
    criteria: string[],
    options?: JudgmentOptions
  ): Promise<EvaluateJudgmentResult> {
    logger.info({ fieldName }, "OpenAiProvider.evaluateJudgment");
    try {
      const scale = options?.scale ?? "RED_YELLOW_GREEN";
      const { content } = await this.chat([
        {
          role: "system",
          content:
            "You are a B2B SaaS account health evaluator. " +
            `Evaluate the given value against the criteria on the scale: ${scale}. ` +
            "Return valid JSON with fields: score (number|null), label (string), reasoning (string), confidence (HIGH|MEDIUM|LOW).",
        },
        {
          role: "user",
          content:
            `Field: "${fieldName}"\nValue: ${JSON.stringify(value)}\n` +
            `Criteria:\n${criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}` +
            (options?.threshold ? `\nThreshold: ${options.threshold}` : ""),
        },
      ]);

      const parsed = JSON.parse(content);
      return {
        fieldName,
        score: parsed.score ?? null,
        label: parsed.label ?? "Unknown",
        reasoning: parsed.reasoning ?? "",
        confidence: parsed.confidence ?? "MEDIUM",
      };
    } catch (err) {
      throw new LlmProviderError("openai", err instanceof Error ? err.message : "evaluateJudgment failed");
    }
  }
}
