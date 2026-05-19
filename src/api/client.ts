const DEFAULT_API_BASE = "https://markitup.app/api/v1";

export interface ApiClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export class MarkItUpApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
    this.name = "MarkItUpApiError";
  }
}

export class MarkItUpApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(opts: ApiClientOptions) {
    if (!opts.apiKey) {
      throw new Error("MARKITUP_API_KEY is required");
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_API_BASE).replace(/\/$/, "");
  }

  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await fetch(url, {
      method,
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
        "User-Agent": "markitup-mcp-server/0.1.0",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { error: text };
    }

    if (!res.ok) {
      const errorMessage =
        (parsed as { error?: string }).error ?? `HTTP ${res.status}`;
      throw new MarkItUpApiError(
        humanizeError(res.status, errorMessage),
        res.status,
        codeForStatus(res.status)
      );
    }

    const wrapper = parsed as { data?: T };
    return (wrapper.data ?? parsed) as T;
  }
}

function codeForStatus(status: number): string {
  switch (status) {
    case 401:
      return "unauthenticated";
    case 402:
      return "payment_required";
    case 403:
      return "permission_denied";
    case 404:
      return "not_found";
    case 429:
      return "rate_limited";
    default:
      return status >= 500 ? "server_error" : "bad_request";
  }
}

function humanizeError(status: number, message: string): string {
  switch (status) {
    case 401:
      return "Invalid or missing MARKITUP_API_KEY. Generate a new key at https://markitup.app/dashboard/api-keys";
    case 402:
      return "Out of MarkItUp credits. Top up at https://markitup.app/credits";
    case 429:
      return "Rate limit exceeded. Wait a moment and retry.";
    default:
      return message;
  }
}
