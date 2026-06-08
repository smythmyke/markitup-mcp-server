import { MarkItUpApiClient } from "../api/client.js";

export const upscaleTool = {
  name: "markitup_upscale",
  description:
    "Upscale and sharpen an image with AI super-resolution (enlarge 2×, 3×, or 4×). " +
    "Enhances photos, screenshots, logos, and AI-generated images for print, retina displays, or zoom — without blur or pixelation. " +
    "Returns the enlarged PNG. Costs 1 credit (free for active Pro/Power subscribers). " +
    "Provide the source image either as a public URL (image_url) OR as base64 (image_base64) — exactly one.",
  inputSchema: {
    type: "object",
    properties: {
      image_url: {
        type: "string",
        description: "Public HTTPS URL of the source image. Mutually exclusive with image_base64.",
      },
      image_base64: {
        type: "string",
        description: "Base64-encoded source image (no data: prefix). Mutually exclusive with image_url.",
      },
      image_mime_type: {
        type: "string",
        description: "MIME type when supplying image_base64. Defaults to image/png.",
        default: "image/png",
      },
      upscale_factor: {
        type: "number",
        enum: [2, 3, 4],
        description: "How much to enlarge each dimension. Default 4.",
        default: 4,
      },
    },
    additionalProperties: false,
  },
} as const;

interface UpscaleBackendResponse {
  resultDataUrl: string;
  cost?: number;
}

interface ImageContent { type: "image"; data: string; mimeType: string }
interface TextContent { type: "text"; text: string }

export async function runUpscale(
  api: MarkItUpApiClient,
  args: Record<string, unknown>
): Promise<{
  content: Array<TextContent | ImageContent>;
  structuredContent: UpscaleBackendResponse;
}> {
  const imageUrl = typeof args.image_url === "string" ? args.image_url : undefined;
  const imageBase64 = typeof args.image_base64 === "string" ? args.image_base64 : undefined;
  const mimeType = typeof args.image_mime_type === "string" ? args.image_mime_type : "image/png";
  const upscaleFactor = typeof args.upscale_factor === "number" ? args.upscale_factor : 4;

  if (!!imageUrl === !!imageBase64) {
    throw new Error("Provide exactly one of image_url or image_base64");
  }

  const imageDataUrl = imageUrl
    ? await fetchAsDataUrl(imageUrl)
    : `data:${mimeType};base64,${imageBase64}`;

  const data = await api.post<UpscaleBackendResponse>("/upscale", {
    imageDataUrl,
    upscaleFactor,
  });

  const content: Array<TextContent | ImageContent> = [
    { type: "text", text: `Upscaled ${upscaleFactor}×.` },
  ];
  const parsed = parseDataUrl(data.resultDataUrl);
  if (parsed) {
    content.push({ type: "image", data: parsed.data, mimeType: parsed.mimeType });
  }

  return { content, structuredContent: data };
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image_url (${res.status}): ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/png";
  return `data:${contentType};base64,${buf.toString("base64")}`;
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl?.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}
