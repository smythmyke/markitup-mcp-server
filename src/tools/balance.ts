import { MarkItUpApiClient } from "../api/client.js";

export const balanceTool = {
  name: "markitup_credit_balance",
  description:
    "Return the current MarkItUp credit balance and subscription status for the authenticated account. " +
    "Use this before calling generation tools to verify the account has credits available.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
} as const;

interface BalanceResponse {
  balance: number;
  subscriptionCredits?: number;
  topupCredits?: number;
  subscription?: {
    status: string;
    planId?: string;
  } | null;
}

export async function runBalance(api: MarkItUpApiClient): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: BalanceResponse;
}> {
  const data = await api.post<BalanceResponse>("/credits/balance", {});

  const lines = [
    `Credit balance: ${data.balance}`,
    data.subscriptionCredits !== undefined
      ? `  • Subscription credits: ${data.subscriptionCredits}`
      : null,
    data.topupCredits !== undefined
      ? `  • Top-up credits: ${data.topupCredits}`
      : null,
    data.subscription
      ? `Subscription: ${data.subscription.planId ?? "unknown"} (${data.subscription.status})`
      : "Subscription: none",
  ].filter((s): s is string => s !== null);

  return {
    content: [{ type: "text", text: lines.join("\n") }],
    structuredContent: data,
  };
}
