import { MarkItUpApiClient } from "../api/client.js";

export const uploadImageTool = {
  name: "markitup_upload_image",
  description:
    "Upload a base64 image and get back a public markitup.app URL you can pass to the other MarkItUp tools. " +
    "Use this when the user has a local image that isn't already on the web: stage it here first, then call the editing tool with the returned url. Free.",
  inputSchema: {
    type: "object",
    properties: {
      image_base64: { type: "string", description: "Base64-encoded image bytes (no data: prefix)." },
      image_mime_type: { type: "string", description: "MIME type. Defaults to image/png.", default: "image/png" },
    },
    required: ["image_base64"],
    additionalProperties: false,
  },
} as const;

interface UploadBackendResponse {
  url: string;
}

export async function runUploadImage(
  api: MarkItUpApiClient,
  args: Record<string, unknown>
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: UploadBackendResponse;
}> {
  const imageBase64 = typeof args.image_base64 === "string" ? args.image_base64 : "";
  const mimeType = typeof args.image_mime_type === "string" ? args.image_mime_type : "image/png";
  if (!imageBase64) throw new Error("image_base64 is required");

  const data = await api.post<UploadBackendResponse>("/upload", {
    imageDataUrl: `data:${mimeType};base64,${imageBase64}`,
  });

  return {
    content: [{ type: "text", text: `Uploaded. URL: ${data.url}` }],
    structuredContent: data,
  };
}
