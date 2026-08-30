import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { askStructured, isAiConfigured } from "./client";
import { ASSIGNMENT_VISION_SYSTEM } from "./prompts";
import {
  assignmentExtractionSchema,
  type AssignmentExtraction,
} from "./schemas";

/**
 * Reads an assignment out of a photo.
 *
 * Nothing extracted here is saved automatically — the caller shows it to the
 * user for confirmation first. A wrong due date entered silently is worse than
 * a due date the student has to correct.
 */

export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

/** 5 MB — comfortably above a phone photo, well under the request limit. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export class ImageUnsupportedError extends Error {}

/** Splits a `data:` URL and checks it's an image we can actually send. */
export function decodeImageDataUrl(dataUrl: string): {
  mediaType: SupportedImageType;
  base64: string;
} {
  const match = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(
    dataUrl.trim(),
  );
  if (!match) throw new ImageUnsupportedError("That file isn't a valid image.");

  const [, mediaType, base64] = match;
  if (!SUPPORTED_IMAGE_TYPES.includes(mediaType as SupportedImageType)) {
    throw new ImageUnsupportedError("Use a JPEG, PNG, WebP or GIF image.");
  }
  // base64 expands ~4 bytes per 3 source bytes.
  if ((base64.length * 3) / 4 > MAX_IMAGE_BYTES) {
    throw new ImageUnsupportedError("That image is too large — keep it under 5 MB.");
  }

  return { mediaType: mediaType as SupportedImageType, base64 };
}

export async function extractAssignment(
  dataUrl: string,
  opts: { todayKey: string; weekdayName: string },
): Promise<AssignmentExtraction> {
  if (!isAiConfigured()) {
    throw new Error("Image reading needs an ANTHROPIC_API_KEY.");
  }

  const { mediaType, base64 } = decodeImageDataUrl(dataUrl);

  const content: Anthropic.ContentBlockParam[] = [
    {
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64 },
    },
    {
      type: "text",
      text: [
        `Today is ${opts.todayKey} (${opts.weekdayName}).`,
        "Read this assignment and extract what it says.",
      ].join("\n"),
    },
  ];

  return askStructured({
    schema: assignmentExtractionSchema,
    system: ASSIGNMENT_VISION_SYSTEM,
    user: content,
    effort: "medium",
    maxTokens: 2000,
  });
}
