import { MarkItUpApiClient } from "../api/client.js";

export const regenTool = {
  name: "markitup_regen",
  description:
    "Regenerate a single variation from a previous markitup_generate call with the same source image and template. " +
    "Costs 1 credit if charge_credit=true. " +
    "Pass back the source image (as URL or base64) AND the text analysis object returned in the previous generate's structuredContent.text — the regen uses the same headline/copy so visuals stay consistent. " +
    "Use variation_index to choose which slot (0–2) to regenerate.",
  inputSchema: {
    type: "object",
    properties: {
      source_image_url: {
        type: "string",
        description: "Public HTTPS URL of the same source image used in the original markitup_generate.",
      },
      source_image_base64: {
        type: "string",
        description: "Base64-encoded source image (no data: prefix). Mutually exclusive with source_image_url.",
      },
      source_image_mime_type: {
        type: "string",
        description: "MIME type when supplying source_image_base64. Defaults to image/png.",
        default: "image/png",
      },
      template_id: {
        type: "string",
        description: "Same template_id used in the original generate.",
      },
      text_analysis: {
        type: "object",
        description: "The 'text' object from the previous generate's structuredContent — includes headline, subHeadline, marketingCopy.",
        properties: {
          headline: { type: "string" },
          subHeadline: { type: "string" },
          marketingCopy: { type: "string" },
        },
      },
      variation_index: {
        type: "number",
        description: "Which slot (0, 1, or 2) to regenerate. Default 0.",
        default: 0,
      },
      aspect_ratio: { type: "string" },
      image_size: { type: "string", enum: ["1K", "2K", "4K"] },
      charge_credit: {
        type: "boolean",
        description: "If true, deduct 1 credit. Defaults to true.",
        default: true,
      },
    },
    required: ["template_id", "text_analysis"],
    additionalProperties: false,
  },
} as const;

interface RegenBackendResponse {
  variation: string;
  variationIndex?: number;
}

interface ImageContent { type: "image"; data: string; mimeType: string }
interface TextContent { type: "text"; text: string }

export async function runRegen(
  api: MarkItUpApiClient,
  args: Record<string, unknown>
): Promise<{
  content: Array<TextContent | ImageContent>;
  structuredContent: RegenBackendResponse;
}> {
  const sourceImageUrl = typeof args.source_image_url === "string" ? args.source_image_url : undefined;
  const sourceImageBase64 = typeof args.source_image_base64 === "string" ? args.source_image_base64 : undefined;
  const mimeType = typeof args.source_image_mime_type === "string" ? args.source_image_mime_type : "image/png";
  const templateId = typeof args.template_id === "string" ? args.template_id : "";
  const textAnalysis = (args.text_analysis ?? {}) as Record<string, unknown>;
  const variationIndex = typeof args.variation_index === "number" ? args.variation_index : 0;
  const aspectRatio = typeof args.aspect_ratio === "string" ? args.aspect_ratio : undefined;
  const imageSize = typeof args.image_size === "string" ? args.image_size : undefined;
  const chargeCredit = args.charge_credit !== false;

  if (!templateId) throw new Error("template_id is required");
  if (!!sourceImageUrl === !!sourceImageBase64) {
    throw new Error("Provide exactly one of source_image_url or source_image_base64");
  }

  const sourceImageDataUrl = sourceImageUrl
    ? await fetchAsDataUrl(sourceImageUrl)
    : `data:${mimeType};base64,${sourceImageBase64}`;

  const body: Record<string, unknown> = {
    sourceImageDataUrl,
    templateId,
    textAnalysis,
    variationIndex,
    chargeCredit,
  };
  if (aspectRatio) body.aspectRatio = aspectRatio;
  if (imageSize) body.imageSize = imageSize;

  const data = await api.post<RegenBackendResponse>("/regen", body);

  const content: Array<TextContent | ImageContent> = [
    { type: "text", text: `Regenerated variation ${variationIndex}.` },
  ];
  const parsed = parseDataUrl(data.variation);
  if (parsed) {
    content.push({ type: "image", data: parsed.data, mimeType: parsed.mimeType });
  }

  return { content, structuredContent: data };
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch source_image_url (${res.status}): ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/png";
  return `data:${contentType};base64,${buf.toString("base64")}`;
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}
