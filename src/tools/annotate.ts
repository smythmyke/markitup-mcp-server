import { MarkItUpApiClient } from "../api/client.js";

export const annotateTool = {
  name: "markitup_annotate",
  description:
    "Annotate an image with AI-placed callouts. Describe what to point out (e.g. 'highlight the Sign Up button and the search bar') " +
    "and MarkItUp detects those elements and bakes labeled boxes, arrows, and highlights directly onto the image. " +
    "Great for product walkthroughs, tutorials, UI/UX feedback, bug reports, and documentation screenshots. " +
    "Returns a flattened annotated PNG plus the annotation coordinates. Costs 1 credit. " +
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
      context: {
        type: "string",
        description:
          "Natural-language instructions describing which elements to annotate and how (e.g. 'point an arrow at the error message and box the retry button').",
      },
    },
    required: ["context"],
    additionalProperties: false,
  },
} as const;

interface Annotation {
  id: string;
  type: string;
  x: number;
  y: number;
  label: string;
  width?: number;
  height?: number;
  toX?: number;
  toY?: number;
}

interface AnnotateBackendResponse {
  resultDataUrl: string;
  annotations: Annotation[];
}

interface ImageContent { type: "image"; data: string; mimeType: string }
interface TextContent { type: "text"; text: string }

export async function runAnnotate(
  api: MarkItUpApiClient,
  args: Record<string, unknown>
): Promise<{
  content: Array<TextContent | ImageContent>;
  structuredContent: AnnotateBackendResponse;
}> {
  const imageUrl = typeof args.image_url === "string" ? args.image_url : undefined;
  const imageBase64 = typeof args.image_base64 === "string" ? args.image_base64 : undefined;
  const mimeType = typeof args.image_mime_type === "string" ? args.image_mime_type : "image/png";
  const context = typeof args.context === "string" ? args.context : "";

  if (!context) {
    throw new Error("context is required");
  }
  if (!!imageUrl === !!imageBase64) {
    throw new Error("Provide exactly one of image_url or image_base64");
  }

  const imageDataUrl = imageUrl
    ? await fetchAsDataUrl(imageUrl)
    : `data:${mimeType};base64,${imageBase64}`;

  const data = await api.post<AnnotateBackendResponse>("/annotate-render", {
    imageDataUrl,
    context,
  });

  const count = Array.isArray(data.annotations) ? data.annotations.length : 0;
  const content: Array<TextContent | ImageContent> = [
    { type: "text", text: `Added ${count} annotation${count === 1 ? "" : "s"}.` },
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
