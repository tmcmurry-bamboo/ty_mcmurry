/**
 * Google Slides provider — Phase 3 implementation.
 *
 * Responsibilities:
 *   1. Copy a template presentation via Google Drive API
 *   2. Replace all {{TOKEN}} placeholders via batchUpdate replaceAllText
 *   3. Apply visibility conditions (delete slides / hide objects)
 *   4. Return the URL of the newly generated presentation
 *
 * Auth: service-account JSON from GOOGLE_CREDENTIALS_JSON env var,
 *       or Application Default Credentials if the env var is absent.
 */

import { logger } from "@/lib/logger";

export interface TokenReplacement {
  token: string;   // e.g. "{{COMPANY_NAME}}"
  value: string;
}

export interface VisibilityCondition {
  action: "SHOW" | "HIDE";
  targetType: "SLIDE" | "OBJECT";
  targetId: string;  // slide index (0-based) or Google object ID
}

export interface GenerateDeckOptions {
  presentationTitle: string;
  replacements: TokenReplacement[];
  conditions?: VisibilityCondition[];
  folderId?: string;  // Google Drive folder to place the copy in
}

export interface GenerateDeckResult {
  presentationId: string;
  presentationUrl: string;
  title: string;
}

async function getAuth() {
  const { google } = await import("googleapis");
  const credsJson = process.env.GOOGLE_CREDENTIALS_JSON;

  if (credsJson) {
    const credentials = JSON.parse(credsJson);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/presentations",
        "https://www.googleapis.com/auth/drive",
      ],
    });
  }

  return new google.auth.GoogleAuth({
    scopes: [
      "https://www.googleapis.com/auth/presentations",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

export async function generateDeckFromTemplate(
  templateId: string,
  options: GenerateDeckOptions
): Promise<GenerateDeckResult> {
  const { google } = await import("googleapis");
  const auth = await getAuth();
  const drive = google.drive({ version: "v3", auth });
  const slides = google.slides({ version: "v1", auth });

  // 1 — Copy the template
  logger.info({ templateId, title: options.presentationTitle }, "Copying Google Slides template");
  const copyRes = await drive.files.copy({
    fileId: templateId,
    requestBody: {
      name: options.presentationTitle,
      ...(options.folderId ? { parents: [options.folderId] } : {}),
    },
  });

  const newId = copyRes.data.id;
  if (!newId) throw new Error("Google Drive copy returned no file ID");

  logger.info({ newId }, "Template copied — applying replacements");

  // 2 — Build replaceAllText requests for each token
  const replaceRequests = options.replacements.map(({ token, value }) => ({
    replaceAllText: {
      containsText: { text: token, matchCase: true },
      replaceText: value,
    },
  }));

  // 3 — Build visibility requests (delete hidden slides/objects)
  const visibilityRequests: object[] = [];

  if (options.conditions?.length) {
    // Fetch the presentation to resolve slide object IDs by index
    const pres = await slides.presentations.get({ presentationId: newId });
    const slidePages = pres.data.slides ?? [];

    for (const cond of options.conditions) {
      if (cond.action !== "HIDE") continue;

      if (cond.targetType === "SLIDE") {
        const idx = parseInt(cond.targetId, 10);
        const slidePage = slidePages[idx];
        if (slidePage?.objectId) {
          visibilityRequests.push({
            deleteObject: { objectId: slidePage.objectId },
          });
        }
      } else if (cond.targetType === "OBJECT") {
        visibilityRequests.push({
          deleteObject: { objectId: cond.targetId },
        });
      }
    }
  }

  // 4 — Apply all updates in a single batchUpdate
  const allRequests = [...replaceRequests, ...visibilityRequests];
  if (allRequests.length > 0) {
    await slides.presentations.batchUpdate({
      presentationId: newId,
      requestBody: { requests: allRequests },
    });
  }

  const presentationUrl = `https://docs.google.com/presentation/d/${newId}/edit`;
  logger.info({ newId, presentationUrl }, "Deck generation complete");

  return {
    presentationId: newId,
    presentationUrl,
    title: options.presentationTitle,
  };
}

export interface ImportTemplateOptions {
  workingTitle: string;   // name for the working copy in Drive
  folderId?: string;      // optional Drive folder for the copy
}

export interface SlidePackageTag {
  slideIndex: number;     // 0-based
  slideObjectId: string;
  detectedName: string;   // the package name found on the slide
}

export interface ImportTemplateResult {
  workingPresentationId: string;
  tokenReplacementCount: number;  // how many [Field] → {{FIELD}} rewrites
  packageTags: SlidePackageTag[];
}

/**
 * Copy a source presentation into a working copy and:
 *  1. Replace every [Field Name] bracket placeholder with {{FIELD_NAME}} tokens.
 *  2. Detect which slides contain a known package type name (from knownPackageNames).
 *
 * The source file is never modified.
 */
export async function importTemplateFromSource(
  sourcePresentationId: string,
  knownPackageNames: string[],
  options: ImportTemplateOptions
): Promise<ImportTemplateResult> {
  const { google } = await import("googleapis");
  const auth = await getAuth();
  const drive = google.drive({ version: "v3", auth });
  const slides = google.slides({ version: "v1", auth });

  // 1 — Read the source to find [Field] patterns and package slides
  logger.info({ sourcePresentationId }, "Reading source presentation for import scan");
  const sourceRes = await slides.presentations.get({ presentationId: sourcePresentationId });
  const sourceSlides = sourceRes.data.slides ?? [];

  // Collect unique bracket labels and detect package-tagged slides
  const bracketLabels = new Set<string>();
  const packageTags: SlidePackageTag[] = [];
  const BRACKET_RE = /\[([^\][\n]{1,60})\]/g;

  for (const [idx, slide] of sourceSlides.entries()) {
    let slideText = "";
    for (const el of slide.pageElements ?? []) {
      for (const te of el.shape?.text?.textElements ?? []) {
        const content = te.textRun?.content ?? "";
        slideText += content;
        let m: RegExpExecArray | null;
        BRACKET_RE.lastIndex = 0;
        while ((m = BRACKET_RE.exec(content)) !== null) {
          bracketLabels.add(m[1].trim());
        }
      }
    }

    // Check if this slide's full text contains a known package name
    const normSlide = slideText.trim();
    for (const pkgName of knownPackageNames) {
      if (normSlide.toLowerCase().includes(pkgName.toLowerCase())) {
        packageTags.push({
          slideIndex: idx,
          slideObjectId: slide.objectId ?? "",
          detectedName: pkgName,
        });
        break;
      }
    }
  }

  // 2 — Copy the source presentation
  logger.info({ sourcePresentationId, title: options.workingTitle }, "Copying source to working template");
  const copyRes = await drive.files.copy({
    fileId: sourcePresentationId,
    requestBody: {
      name: options.workingTitle,
      ...(options.folderId ? { parents: [options.folderId] } : {}),
    },
  });

  const workingId = copyRes.data.id;
  if (!workingId) throw new Error("Google Drive copy returned no file ID");

  // 3 — Build replaceAllText requests: [Field Name] → {{FIELD_NAME}}
  const replaceRequests = Array.from(bracketLabels).map((label) => {
    const token = `{{${label.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")}}}`;
    return {
      replaceAllText: {
        containsText: { text: `[${label}]`, matchCase: false },
        replaceText: token,
      },
    };
  });

  if (replaceRequests.length > 0) {
    logger.info({ workingId, count: replaceRequests.length }, "Rewriting bracket tokens in working copy");
    await slides.presentations.batchUpdate({
      presentationId: workingId,
      requestBody: { requests: replaceRequests },
    });
  }

  logger.info({ workingId, tokenReplacementCount: replaceRequests.length }, "Template import complete");

  return {
    workingPresentationId: workingId,
    tokenReplacementCount: replaceRequests.length,
    packageTags,
  };
}

/**
 * Validate that credentials can reach the Google APIs.
 */
export async function validateGoogleConnection(): Promise<{
  success: boolean;
  latencyMs: number;
  message: string;
}> {
  const start = Date.now();
  try {
    const { google } = await import("googleapis");
    const auth = await getAuth();
    const drive = google.drive({ version: "v3", auth });
    await drive.about.get({ fields: "user" });
    return { success: true, latencyMs: Date.now() - start, message: "Google APIs reachable" };
  } catch (err) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : "Google connection failed",
    };
  }
}
