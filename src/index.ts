#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { MarkItUpApiClient, MarkItUpApiError } from "./api/client.js";
import { balanceTool, runBalance } from "./tools/balance.js";
import { generateTool, runGenerate } from "./tools/generate.js";
import { regenTool, runRegen } from "./tools/regen.js";
import { extendTool, runExtend } from "./tools/extend.js";
import { bgremoveTool, runBgRemove } from "./tools/bgremove.js";

const SERVER_NAME = "markitup";
const SERVER_VERSION = "0.1.0";

function readEnv(name: string, required = true): string {
  const value = process.env[name];
  if (!value && required) {
    process.stderr.write(
      `[markitup-mcp] ${name} is not set. Generate a key at https://markitup.app/dashboard/api-keys and set it in your MCP client config.\n`
    );
    process.exit(1);
  }
  return value ?? "";
}

async function main(): Promise<void> {
  const apiKey = readEnv("MARKITUP_API_KEY");
  const baseUrl = process.env.MARKITUP_API_BASE;

  const api = new MarkItUpApiClient({ apiKey, baseUrl });

  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  const tools: Tool[] = [
    balanceTool as unknown as Tool,
    generateTool as unknown as Tool,
    regenTool as unknown as Tool,
    extendTool as unknown as Tool,
    bgremoveTool as unknown as Tool,
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      switch (name) {
        case balanceTool.name:
          return await runBalance(api);
        case generateTool.name:
          return await runGenerate(api, args ?? {});
        case regenTool.name:
          return await runRegen(api, args ?? {});
        case extendTool.name:
          return await runExtend(api, args ?? {});
        case bgremoveTool.name:
          return await runBgRemove(api, args ?? {});
        default:
          return errorResult(`Unknown tool: ${name}`);
      }
    } catch (err) {
      if (err instanceof MarkItUpApiError) {
        return errorResult(err.message);
      }
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(message);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function errorResult(message: string): {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

main().catch((err) => {
  process.stderr.write(
    `[markitup-mcp] Fatal: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
