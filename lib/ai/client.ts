import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/**
 * The one place DayOS talks to a model.
 *
 * Everything else in `lib/ai/` describes *what* it wants; this module owns the
 * client, the model id, error translation, and the rule that every response
 * comes back as schema-validated JSON rather than prose to be regex'd.
 */

export const AI_MODEL = process.env.DAYOS_AI_MODEL || "claude-opus-5";

/** False in local development without a key — callers then use a fallback. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

/** Thrown when no model is configured, or the call failed. */
export class AiUnavailableError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AiUnavailableError";
    this.cause = cause;
  }
}

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface StructuredRequest<S extends z.ZodType> {
  schema: S;
  system: string;
  /** User turn: either plain text or a mix of text and images. */
  user: string | Anthropic.ContentBlockParam[];
  /** Depth to think at. Quick extraction stays low; planning goes high. */
  effort?: Effort;
  maxTokens?: number;
}

/**
 * Ask the model for a value matching `schema`.
 *
 * Structured outputs mean the response is constrained to the schema's shape,
 * and the schema is re-validated here regardless — a malformed response is a
 * failure the caller can fall back from, never data that reaches the database.
 */
export async function askStructured<S extends z.ZodType>(
  req: StructuredRequest<S>,
): Promise<z.infer<S>> {
  if (!isAiConfigured()) {
    throw new AiUnavailableError("No ANTHROPIC_API_KEY configured");
  }

  try {
    const response = await getClient().messages.parse({
      model: AI_MODEL,
      max_tokens: req.maxTokens ?? 8000,
      system: req.system,
      output_config: {
        format: zodOutputFormat(req.schema),
        effort: req.effort ?? "medium",
      },
      messages: [
        {
          role: "user",
          content: req.user,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      throw new AiUnavailableError("The model declined this request");
    }

    const parsed = response.parsed_output;
    if (parsed == null) {
      throw new AiUnavailableError("The model returned no usable output");
    }

    // Re-validate: `parsed_output` is already schema-shaped, but this is the
    // boundary where model output becomes application data.
    return req.schema.parse(parsed);
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;

    if (error instanceof Anthropic.RateLimitError) {
      throw new AiUnavailableError("Rate limited — try again shortly", error);
    }
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AiUnavailableError("The configured API key was rejected", error);
    }
    if (error instanceof Anthropic.APIError) {
      throw new AiUnavailableError(`Model request failed (${error.status})`, error);
    }
    throw new AiUnavailableError("Model request failed", error);
  }
}
