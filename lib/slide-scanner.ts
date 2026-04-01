/**
 * Slide scanner — extracts token placeholders from a Google Slides presentation.
 *
 * Detects two placeholder formats:
 *   1. {{UPPERCASE_TOKEN}}  — explicit token syntax
 *   2. [Field Name]         — bracket label syntax (auto-converted to token)
 *
 * Works in two modes:
 *   1. Real API mode  — when GOOGLE_APPLICATION_CREDENTIALS is set
 *   2. Stub mode      — returns an empty result (safe fallback for dev)
 *
 * Type inference heuristics (applied to normalised field name):
 *   date / since / anniversary / hired / effective  → DATE
 *   count / headcount / logins / sessions / hours
 *   openings / users / amount / total / ytd / arr
 *   nrr / mrr / rate / pct / percent / num          → NUMBER
 *   tracking / management / calendar / app / survey
 *   feed / signature / workflow / approval / marketplace
 *   api / integration / notification / tasks / email
 *   reporting / directory / branding / storage
 *   assessments / feedback / payroll / benefits
 *   onboarding / offboarding / polls / dashboards
 *   benchmarking / planning / alerts / access
 *   mobile / portal / builder / module / feature    → BOOLEAN
 *   score / health / risk / rating / sentiment      → JUDGMENT
 *   narrative / summary / description / notes       → NARRATIVE
 *   Otherwise                                       → TEXT
 */

const TOKEN_REGEX = /\{\{([A-Z0-9_]+)\}\}/g;
const BRACKET_REGEX = /\[([^\]\[]{1,60})\]/g;

// Re-export pure token utilities (client-safe, no Node.js deps)
export { normalizeToken, fuzzyMatchToken } from "./token-utils";
import { fuzzyMatchToken } from "./token-utils";
import type { CachedSlide, CachedSlideElement, SlideStructure } from "./slide-structure-types";
import { emuToPoints } from "./slide-structure-types";

export type InferredFieldType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "BOOLEAN"
  | "JUDGMENT"
  | "NARRATIVE";

export interface ScannedToken {
  raw: string;
  name: string;
  inferredType: InferredFieldType;
  index: number;
  slideNumbers: number[];
}

export interface ScanResult {
  slideId: string;
  tokens: ScannedToken[];
  rawText: string;
  slideStructure?: SlideStructure;
  /** Non-empty when the scan could not access the slides API */
  error?: string;
}

function inferFieldType(name: string): InferredFieldType {
  const u = name.toUpperCase().replace(/\s+/g, "_");

  // DATE
  if (/DATE|_AT$|_ON$|SINCE|ANNIVERSARY|HIRED|EFFECTIVE/.test(u)) return "DATE";

  // NUMBER — metric / count words
  if (/^ARR|^NRR|^MRR|^YTD|COUNT|HEADCOUNT|LOGIN|SESSION|HOURS?|OPENING|AMOUNT|TOTAL|_NUM$|_NUMBER$|_RATE$|_PCT$|_PERCENT$|AVAILABLE_SESSIONS|AVAILABLE_HOURS|USERS_ENABLED|VALUED_USERS|NON[_-]ADMIN/.test(u)) return "NUMBER";

  // BOOLEAN — feature module / capability names
  if (/^IS_|^HAS_|_FLAG$|TRACKING|MANAGEMENT|CALENDAR|_APP$|^APP_|SURVEY|_FEED$|SIGNATURE|WORKFLOW|APPROVAL|MARKETPLACE|_API$|^API_|INTEGRATION|NOTIFICATION|_TASKS?$|EMAIL|REPORTING|DIRECTORY|BRANDING|STORAGE|ASSESSMENT|FEEDBACK|PAYROLL|BENEFITS|ONBOARDING|OFFBOARDING|POLL|DASHBOARD|BENCHMARKING|PLANNING|ALERT|_ACCESS$|MOBILE|PORTAL|BUILDER|MODULE|FEATURE|ANNOUNCEMENT|HOLIDAY|ICAL|ORGANIZ|JOB_BOARD|JOB_PIPELINE|TALENT_POOL|ELECTRONIC|WELCOME|HIRE_PACKET|NEW_HIRE|HEATMAP|QUESTION_BANK|REWARDS|AUDIT_TRAIL|TURNOVER|ACA_|SHIFT|PROJECT_TRACK|COMMUNITY|PEER_|UPWARD_|BLIND|IMPROMPTU|PRE_BUILT|SEGMENT_BY|360|ENPS|CANDIDATE|CAREERS|DISQUALIF|OFFER_LETTER|HIRING|JOB_OPENING|SLACK/.test(u)) return "BOOLEAN";

  // JUDGMENT
  if (/_SCORE$|_HEALTH$|_RISK$|_RATING$|_SENTIMENT$/.test(u)) return "JUDGMENT";

  // NARRATIVE
  if (/_NARRATIVE$|_SUMMARY$|_DESCRIPTION$|_NOTES?$/.test(u)) return "NARRATIVE";

  return "TEXT";
}

function tokenNameToFieldName(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/** Convert a human label like "Company Name" to token format "{{COMPANY_NAME}}" */
function labelToToken(label: string): string {
  const key = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `{{${key}}}`;
}

/**
 * Scan a Google Slide for {{TOKEN}} patterns.
 * Falls back to stub if the Google API is unavailable.
 *
 * @param existingFieldTokens - raw tokens already defined as fields on this template.
 *   Used to fuzzy-resolve slide tokens: if a slide token prefix-matches an existing
 *   field token, the existing field token is used as the canonical token so no
 *   duplicate field is created.
 */
export async function scanSlideTokens(
  slideId: string,
  existingFieldTokens: string[] = []
): Promise<ScanResult> {
  const hasServiceAccount = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CREDENTIALS_JSON);
  const hasApiKey = !!process.env.GOOGLE_API_KEY;
  if (!hasServiceAccount && !hasApiKey) {
    return {
      ...stubScan(slideId),
      error: "No Google credentials configured. Set GOOGLE_CREDENTIALS_JSON, GOOGLE_APPLICATION_CREDENTIALS, or GOOGLE_API_KEY in your .env file.",
    };
  }
  try {
    return await realScan(slideId, existingFieldTokens);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ...stubScan(slideId),
      error: `Scan failed: ${msg}`,
    };
  }
}

async function realScan(slideId: string, existingFieldTokens: string[] = []): Promise<ScanResult> {
  const { google } = await import("googleapis");

  // Auth waterfall: inline JSON → credentials file → API key → give up
  const jsonCreds = process.env.GOOGLE_CREDENTIALS_JSON;
  const credFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const apiKey = process.env.GOOGLE_API_KEY;

  let slides;

  if (jsonCreds) {
    const credentials = JSON.parse(jsonCreds);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/presentations.readonly"],
    });
    slides = google.slides({ version: "v1", auth });
  } else if (credFilePath) {
    // Verify file exists before handing it to GoogleAuth
    const fs = await import("fs");
    let fileExists = false;
    try { fileExists = fs.statSync(credFilePath).isFile(); } catch { /* missing */ }

    if (fileExists) {
      const auth = new google.auth.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/presentations.readonly"],
      });
      slides = google.slides({ version: "v1", auth });
    }
    // If file missing, fall through to API key below
  }

  if (!slides && apiKey) {
    // API key auth — works for presentations shared with "Anyone with the link"
    slides = google.slides({ version: "v1", auth: apiKey });
  }

  if (!slides) {
    return stubScan(slideId);
  }

  // Temporarily bypass TLS rejection for environments behind corporate proxies
  // with self-signed certificates (dev only — not recommended for production).
  const prevTLS = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  if (process.env.NODE_ENV !== "production") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
  let presentation;
  try {
    const res = await slides.presentations.get({ presentationId: slideId });
    presentation = res.data;
  } finally {
    // Restore original TLS setting
    if (prevTLS === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTLS;
    }
  }

  // Page dimensions (default 10" × 5.625" = 720 × 405 pt for 16:9)
  const pageW = presentation.pageSize?.width?.magnitude
    ? emuToPoints(presentation.pageSize.width.magnitude)
    : 720;
  const pageH = presentation.pageSize?.height?.magnitude
    ? emuToPoints(presentation.pageSize.height.magnitude)
    : 405;

  const tokenMap = new Map<string, ScannedToken>();
  let index = 0;
  const cachedSlides: CachedSlide[] = [];

  for (const [slideIdx, slide] of (presentation.slides ?? []).entries()) {
    const slideNum = slideIdx + 1;
    const cachedElements: CachedSlideElement[] = [];

    for (const element of slide.pageElements ?? []) {
      // ── Extract element position ──────────────────────────────────
      const transform = element.transform;
      const sizeW = element.size?.width?.magnitude ? emuToPoints(element.size.width.magnitude) : 0;
      const sizeH = element.size?.height?.magnitude ? emuToPoints(element.size.height.magnitude) : 0;
      const posX = transform?.translateX ? emuToPoints(transform.translateX) : 0;
      const posY = transform?.translateY ? emuToPoints(transform.translateY) : 0;

      // ── Determine element type ────────────────────────────────────
      let elType: CachedSlideElement["type"] = "OTHER";
      const shapeType = element.shape?.shapeType ?? undefined;
      if (element.image) {
        elType = "IMAGE";
      } else if (element.table) {
        elType = "TABLE";
      } else if (element.line) {
        elType = "LINE";
      } else if (shapeType === "TEXT_BOX") {
        elType = "TEXT_BOX";
      } else if (element.shape) {
        elType = "SHAPE";
      }

      // ── Extract text content ──────────────────────────────────────
      const textRuns = element.shape?.text?.textElements ?? [];
      const rawText = textRuns.map((te) => te.textRun?.content ?? "").join("");

      // ── Extract styling ───────────────────────────────────────────
      const shapeFill = element.shape?.shapeProperties?.shapeBackgroundFill?.solidFill;
      const fillColor = rgbToHex(shapeFill?.color?.rgbColor);
      const borderFill = element.shape?.shapeProperties?.outline?.outlineFill?.solidFill;
      const borderColor = rgbToHex(borderFill?.color?.rgbColor);

      // Dominant font size: pick the first textRun that has a style
      let fontSize: number | undefined;
      let fontColor: string | undefined;
      for (const te of textRuns) {
        if (te.textRun?.style?.fontSize?.magnitude) {
          fontSize = te.textRun.style.fontSize.magnitude;
          fontColor = rgbToHex(te.textRun.style.foregroundColor?.opaqueColor?.rgbColor);
          break;
        }
      }

      // ── Collect tokens from this element ──────────────────────────
      const elementTokens: string[] = [];
      let match: RegExpExecArray | null;
      TOKEN_REGEX.lastIndex = 0;
      while ((match = TOKEN_REGEX.exec(rawText)) !== null) {
        const raw = match[0];
        const name = match[1];
        elementTokens.push(raw);
        if (tokenMap.has(raw)) {
          tokenMap.get(raw)!.slideNumbers.push(slideNum);
        } else {
          tokenMap.set(raw, {
            raw,
            name: tokenNameToFieldName(name),
            inferredType: inferFieldType(name),
            index: index++,
            slideNumbers: [slideNum],
          });
        }
      }

      BRACKET_REGEX.lastIndex = 0;
      while ((match = BRACKET_REGEX.exec(rawText)) !== null) {
        const label = match[1].trim();
        const raw = labelToToken(label);
        elementTokens.push(raw);
        if (tokenMap.has(raw)) {
          tokenMap.get(raw)!.slideNumbers.push(slideNum);
        } else {
          tokenMap.set(raw, {
            raw,
            name: tokenNameToFieldName(label),
            inferredType: inferFieldType(label),
            index: index++,
            slideNumbers: [slideNum],
          });
        }
      }

      cachedElements.push({
        objectId: element.objectId ?? `el-${slideIdx}-${cachedElements.length}`,
        type: elType,
        position: { x: posX, y: posY, width: sizeW, height: sizeH },
        ...(rawText ? { text: rawText } : {}),
        ...(elementTokens.length > 0 ? { tokens: elementTokens } : {}),
        ...(shapeType && shapeType !== "TEXT_BOX" ? { shapeType } : {}),
        ...(fillColor ? { fillColor } : {}),
        ...(borderColor ? { borderColor } : {}),
        ...(fontSize ? { fontSize } : {}),
        ...(fontColor ? { fontColor } : {}),
      });
    }

    cachedSlides.push({
      index: slideIdx,
      pageObjectId: slide.objectId ?? `slide-${slideIdx}`,
      width: pageW,
      height: pageH,
      elements: cachedElements,
    });
  }

  // Fuzzy-resolve: if a slide token prefix-matches an existing field token,
  // replace it with the canonical field token so no duplicate is created.
  const resolvedMap = new Map<string, ScannedToken>();
  for (const [raw, token] of tokenMap.entries()) {
    const match = existingFieldTokens.find((ft) => fuzzyMatchToken(raw, ft));
    const canonicalRaw = match ?? raw;
    if (!resolvedMap.has(canonicalRaw)) {
      resolvedMap.set(canonicalRaw, { ...token, raw: canonicalRaw });
    } else {
      // Merge slide numbers
      resolvedMap.get(canonicalRaw)!.slideNumbers.push(...token.slideNumbers);
    }
  }

  return {
    slideId,
    tokens: Array.from(resolvedMap.values()),
    rawText: Array.from(resolvedMap.keys()).join(" "),
    slideStructure: cachedSlides,
  };
}

/** Convert a Google Slides RgbColor to hex string, or undefined. */
function rgbToHex(rgb?: { red?: number | null; green?: number | null; blue?: number | null } | null): string | undefined {
  if (!rgb) return undefined;
  const r = Math.round((rgb.red ?? 0) * 255);
  const g = Math.round((rgb.green ?? 0) * 255);
  const b = Math.round((rgb.blue ?? 0) * 255);
  // Skip pure black default (likely means "not set")
  if (r === 0 && g === 0 && b === 0) return undefined;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function stubScan(slideId: string): ScanResult {
  return { slideId, tokens: [], rawText: "" };
}

/**
 * Parse tokens directly from raw text (used in tests and for manual entry).
 * Handles both {{TOKEN}} and [Field Name] formats.
 */
export function parseTokensFromText(text: string): ScannedToken[] {
  const tokenMap = new Map<string, ScannedToken>();
  let index = 0;
  let match: RegExpExecArray | null;

  // {{TOKEN}} patterns
  const curlyRegex = new RegExp(TOKEN_REGEX.source, "g");
  while ((match = curlyRegex.exec(text)) !== null) {
    const raw = match[0];
    const name = match[1];
    if (!tokenMap.has(raw)) {
      tokenMap.set(raw, {
        raw,
        name: tokenNameToFieldName(name),
        inferredType: inferFieldType(name),
        index: index++,
        slideNumbers: [],
      });
    }
  }

  // [Field Name] bracket patterns
  const bracketRegex = new RegExp(BRACKET_REGEX.source, "g");
  while ((match = bracketRegex.exec(text)) !== null) {
    const label = match[1].trim();
    const raw = labelToToken(label);
    if (!tokenMap.has(raw)) {
      tokenMap.set(raw, {
        raw,
        name: tokenNameToFieldName(label),
        inferredType: inferFieldType(label),
        index: index++,
        slideNumbers: [],
      });
    }
  }

  return Array.from(tokenMap.values());
}
