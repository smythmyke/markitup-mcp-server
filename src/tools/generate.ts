import { MarkItUpApiClient } from "../api/client.js";

export const generateTool = {
  name: "markitup_generate",
  description:
    "Generate polished marketing-visual variations of a screenshot or image using the MarkItUp pipeline " +
    "(Claude analyzes the image and writes copy; Gemini renders the visuals). " +
    "Costs 1 credit. " +
    "Provide the image either as a public URL (image_url) OR as a base64-encoded string (image_base64) — exactly one. " +
    "Common template IDs: glassmorphic, clean_minimal, bold_marketing, dark_professional, documentation. " +
    "Returns the generated images plus the marketing copy (headline, subhead) written by Claude.",
  inputSchema: {
    type: "object",
    properties: {
      image_url: {
        type: "string",
        description:
          "Public HTTPS URL of the source image. Mutually exclusive with image_base64.",
      },
      image_base64: {
        type: "string",
        description:
          "Base64-encoded image bytes (no data: prefix). Mutually exclusive with image_url.",
      },
      image_mime_type: {
        type: "string",
        description:
          "MIME type when supplying image_base64. Defaults to image/png.",
        default: "image/png",
      },
      description: {
        type: "string",
        description:
          "Natural-language description of what the image shows and what should be highlighted or emphasized.",
      },
      template_id: {
        type: "string",
        description:
          "Template ID controlling visual style. Standard options: glassmorphic, clean_minimal, bold_marketing, dark_professional, documentation.",
      },
      aspect_ratio: {
        type: "string",
        description:
          "Optional. One of: 1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9.",
      },
      image_size: {
        type: "string",
        enum: ["1K", "2K", "4K"],
        description: "Optional output resolution tier. Defaults to backend choice.",
      },
    },
    required: ["description", "template_id"],
    additionalProperties: false,
  },
} as const;

interface GenerateBackendResponse {
  text: {
    headline?: string;
    subHeadline?: string;
    marketingCopy?: string;
  } | null;
  variations: string[];
}

interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

interface TextContent {
  type: "text";
  text: string;
}

export async function runGenerate(
  api: MarkItUpApiClient,
  args: Record<string, unknown>
): Promise<{
  content: Array<TextContent | ImageContent>;
  structuredContent: GenerateBackendResponse;
}> {
  const imageUrl = typeof args.image_url === "string" ? args.image_url : undefined;
  const imageBase64 = typeof args.image_base64 === "string" ? args.image_base64 : undefined;
  const mimeType = typeof args.image_mime_type === "string" ? args.image_mime_type : "image/png";
  const description = typeof args.description === "string" ? args.description : "";
  const templateId = typeof args.template_id === "string" ? args.template_id : "";
  const aspectRatio = typeof args.aspect_ratio === "string" ? args.aspect_ratio : undefined;
  const imageSize = typeof args.image_size === "string" ? args.image_size : undefined;

  if (!description || !templateId) {
    throw new Error("description and template_id are required");
  }
  if (!!imageUrl === !!imageBase64) {
    throw new Error("Provide exactly one of image_url or image_base64");
  }

  const imageDataUrl = imageUrl
    ? await fetchAsDataUrl(imageUrl)
    : `data:${mimeType};base64,${imageBase64}`;

  const body: Record<string, unknown> = {
    imageDataUrl,
    description,
    templateId,
  };
  if (aspectRatio) body.aspectRatio = aspectRatio;
  if (imageSize) body.imageSize = imageSize;

  const data = await api.post<GenerateBackendResponse>("/generate", body);

  const content: Array<TextContent | ImageContent> = [];
  const headline = data.text?.headline;
  const sub = data.text?.subHeadline;
  if (headline || sub) {
    content.push({
      type: "text",
      text: [
        headline ? `Headline: ${headline}` : null,
        sub ? `Sub-headline: ${sub}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  } else {
    content.push({ type: "text", text: "Generated 3 variations." });
  }

  for (const variation of data.variations) {
    const parsed = parseDataUrl(variation);
    if (parsed) {
      content.push({
        type: "image",
        data: parsed.data,
        mimeType: parsed.mimeType,
      });
    }
  }

  return { content, structuredContent: data };
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image_url (${res.status}): ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/png";
  return `data:${contentType};base64,${buf.toString("base64")}`;
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}
