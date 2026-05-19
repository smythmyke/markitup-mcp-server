import { MarkItUpApiClient } from "../api/client.js";

export const extendTool = {
  name: "markitup_extend",
  description:
    "AI-outpaint an image to a larger canvas. Useful for converting a square asset to 16:9 or 9:16, or extending a tight crop. " +
    "Costs 1 credit. " +
    "Provide the source image as URL or base64, plus the target aspect ratio and pixel dimensions.",
  inputSchema: {
    type: "object",
    properties: {
      image_url: { type: "string", description: "Public HTTPS URL of the source image." },
      image_base64: { type: "string", description: "Base64-encoded source image (no data: prefix). Mutually exclusive with image_url." },
      image_mime_type: { type: "string", default: "image/png" },
      aspect_ratio: {
        type: "string",
        description: "Target aspect ratio. One of: 1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9.",
      },
      target_width: { type: "number", description: "Target output width in pixels." },
      target_height: { type: "number", description: "Target output height in pixels." },
      image_size: { type: "string", enum: ["1K", "2K", "4K"] },
    },
    required: ["aspect_ratio", "target_width", "target_height"],
    additionalProperties: false,
  },
} as const;

interface ExtendBackendResponse {
  imageDataUrl: string;
  width?: number;
  height?: number;
}

interface ImageContent { type: "image"; data: string; mimeType: string }
interface TextContent { type: "text"; text: string }

export async function runExtend(
  api: MarkItUpApiClient,
  args: Record<string, unknown>
): Promise<{
  content: Array<TextContent | ImageContent>;
  structuredContent: ExtendBackendResponse;
}> {
  const imageUrl = typeof args.image_url === "string" ? args.image_url : undefined;
  const imageBase64 = typeof args.image_base64 === "string" ? args.image_base64 : undefined;
  const mimeType = typeof args.image_mime_type === "string" ? args.image_mime_type : "image/png";
  const aspectRatio = typeof args.aspect_ratio === "string" ? args.aspect_ratio : "";
  const targetWidth = typeof args.target_width === "number" ? args.target_width : 0;
  const targetHeight = typeof args.target_height === "number" ? args.target_height : 0;
  const imageSize = typeof args.image_size === "string" ? args.image_size : undefined;

  if (!aspectRatio || !targetWidth || !targetHeight) {
    throw new Error("aspect_ratio, target_width, and target_height are required");
  }
  if (!!imageUrl === !!imageBase64) {
    throw new Error("Provide exactly one of image_url or image_base64");
  }

  const imageDataUrl = imageUrl
    ? await fetchAsDataUrl(imageUrl)
    : `data:${mimeType};base64,${imageBase64}`;

  const body: Record<string, unknown> = {
    imageDataUrl,
    aspectRatio,
    targetWidth,
    targetHeight,
  };
  if (imageSize) body.imageSize = imageSize;

  const data = await api.post<ExtendBackendResponse>("/extend", body);

  const content: Array<TextContent | ImageContent> = [
    { type: "text", text: `Extended to ${data.width ?? targetWidth}x${data.height ?? targetHeight} (${aspectRatio}).` },
  ];
  const parsed = parseDataUrl(data.imageDataUrl);
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
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}
