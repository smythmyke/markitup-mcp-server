import { MarkItUpApiClient } from "../api/client.js";

export const bgremoveTool = {
  name: "markitup_remove_background",
  description:
    "Remove the background from an image using Photoroom's HD AI background-removal service. " +
    "Returns a transparent PNG. Costs 1 credit (free for active Pro/Power subscribers). " +
    "Provide the source image as URL or base64.",
  inputSchema: {
    type: "object",
    properties: {
      image_url: { type: "string", description: "Public HTTPS URL of the source image." },
      image_base64: { type: "string", description: "Base64-encoded source image (no data: prefix). Mutually exclusive with image_url." },
      image_mime_type: { type: "string", default: "image/png" },
    },
    additionalProperties: false,
  },
} as const;

interface BgRemoveBackendResponse {
  imageDataUrl: string;
}

interface ImageContent { type: "image"; data: string; mimeType: string }
interface TextContent { type: "text"; text: string }

export async function runBgRemove(
  api: MarkItUpApiClient,
  args: Record<string, unknown>
): Promise<{
  content: Array<TextContent | ImageContent>;
  structuredContent: BgRemoveBackendResponse;
}> {
  const imageUrl = typeof args.image_url === "string" ? args.image_url : undefined;
  const imageBase64 = typeof args.image_base64 === "string" ? args.image_base64 : undefined;
  const mimeType = typeof args.image_mime_type === "string" ? args.image_mime_type : "image/png";

  if (!!imageUrl === !!imageBase64) {
    throw new Error("Provide exactly one of image_url or image_base64");
  }

  const imageDataUrl = imageUrl
    ? await fetchAsDataUrl(imageUrl)
    : `data:${mimeType};base64,${imageBase64}`;

  const data = await api.post<BgRemoveBackendResponse>("/bgremove", { imageDataUrl });

  const content: Array<TextContent | ImageContent> = [
    { type: "text", text: "Background removed." },
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
