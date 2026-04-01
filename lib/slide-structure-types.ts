/**
 * Cached slide structure types — shared between server (scanner) and client (canvas).
 * No Node.js or googleapis dependencies — safe for client import.
 *
 * Positions/sizes are stored in **points** (1 pt = 1/72 inch).
 * Google Slides API uses EMU (1 pt = 12700 EMU).
 */

export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SlideElementType =
  | "TEXT_BOX"
  | "SHAPE"
  | "IMAGE"
  | "TABLE"
  | "LINE"
  | "OTHER";

export interface CachedSlideElement {
  objectId: string;
  type: SlideElementType;
  position: ElementPosition;
  text?: string;
  tokens?: string[];
  shapeType?: string;       // RECTANGLE, ELLIPSE, STAR_5, etc.
  fillColor?: string;       // hex e.g. "#4285F4"
  borderColor?: string;     // hex
  fontSize?: number;        // dominant font size in pt
  fontColor?: string;       // hex
}

export interface CachedSlide {
  index: number;
  pageObjectId: string;
  width: number;
  height: number;
  elements: CachedSlideElement[];
}

/** The full slideStructure stored as JSON on the Template model. */
export type SlideStructure = CachedSlide[];

/** Convert EMU to points (1 pt = 12700 EMU). */
export function emuToPoints(emu: number): number {
  return Math.round((emu / 12700) * 100) / 100;
}
