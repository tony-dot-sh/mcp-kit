/**
 * Kit.com API v4 Client
 * Handles authentication and HTTP requests to the Kit API
 */

const BASE_URL = "https://api.kit.com/v4";

export interface KitClientOptions {
  apiKey: string;
}

export interface PaginationParams {
  after?: string;
  before?: string;
  per_page?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    has_previous_page: boolean;
    has_next_page: boolean;
    start_cursor: string | null;
    end_cursor: string | null;
    per_page: number;
  };
}

// POST /v4/subscribers/filter — engagement filter condition
export interface FilterCondition {
  type: "opens" | "clicks" | "sent" | "delivered" | "subscribed" | "tags";
  count_greater_than?: number;
  count_less_than?: number;
  after?: string;   // YYYY-MM-DD
  before?: string;  // YYYY-MM-DD
  any?: Array<
    | { type: "broadcasts"; ids: number[] }
    | { type: "urls"; urls: string[]; matching: "contains" | "exact" }
    | { type: "ids"; matching: number[] }
  >;
}

export class KitClient {
  private apiKey: string;

  constructor(options: KitClientOptions) {
    this.apiKey = options.apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;

    const headers: Record<string, string> = {
      "X-Kit-Api-Key": this.apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(options.headers as Record<string, string> || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Kit API error (${response.status}): ${errorBody}`);
    }

    return response.json() as Promise<T>;
  }

  private buildQuery(params: object): string {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const q = searchParams.toString();
    return q ? `?${q}` : "";
  }

  // ── Account ────────────────────────────────────────────────────────────────

  async getAccount(): Promise<any> {
    return this.request("/account");
  }

  // ── Subscribers ────────────────────────────────────────────────────────────

  async listSubscribers(params?: PaginationParams & {
    status?: "active" | "inactive" | "bounced" | "complained" | "cancelled" | "all";
    email_address?: string;       // comma-separated for multi-lookup
    created_after?: string;
    created_before?: string;
    updated_after?: string;
    updated_before?: string;
    sort_field?: "created_at" | "updated_at";
    sort_order?: "asc" | "desc";
    include?: string;             // comma-sep: attribution,tags,location,canceled_at
    slim?: boolean;
    include_total_count?: boolean;
  }): Promise<any> {
    return this.request(`/subscribers${this.buildQuery(params ?? {})}`);
  }

  /** Convenience: look up a subscriber by exact email address. */
  async getSubscriberByEmail(email: string): Promise<any> {
    return this.request(`/subscribers${this.buildQuery({ email_address: email, per_page: 1 })}`);
  }

  async getSubscriber(id: string): Promise<any> {
    return this.request(`/subscribers/${id}`);
  }

  async createSubscriber(data: {
    email_address: string;
    first_name?: string;
    state?: "active" | "inactive";
    fields?: Record<string, string>;
  }): Promise<any> {
    return this.request("/subscribers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateSubscriber(id: string, data: {
    email_address?: string;
    first_name?: string;
    fields?: Record<string, string>;
  }): Promise<any> {
    return this.request(`/subscribers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async unsubscribeSubscriber(id: string): Promise<any> {
    return this.request(`/subscribers/${id}/unsubscribe`, {
      method: "POST",
    });
  }

  /**
   * Returns opens, clicks, bounce, and last-activity stats for a subscriber.
   * Data available from June 2025 onward only.
   */
  async getSubscriberStats(id: string, params?: {
    email_sent_after?: string;   // YYYY-MM-DD
    email_sent_before?: string;  // YYYY-MM-DD
  }): Promise<any> {
    return this.request(`/subscribers/${id}/stats${this.buildQuery(params ?? {})}`);
  }

  async getSubscriberTags(subscriberId: string): Promise<any> {
    return this.request(`/subscribers/${subscriberId}/tags`);
  }

  async addTagToSubscriber(subscriberId: string, tagId: string): Promise<any> {
    // Kit v4 POST /tags/{id}/subscribers requires email_address — not a numeric ID.
    // Fetch the subscriber first to get their email.
    const sub = await this.getSubscriber(subscriberId);
    const email = sub?.subscriber?.email_address;
    if (!email) {
      throw new Error(`Subscriber ${subscriberId} not found or has no email address`);
    }
    return this.request(`/tags/${tagId}/subscribers`, {
      method: "POST",
      body: JSON.stringify({ email_address: email }),
    });
  }

  async removeTagFromSubscriber(subscriberId: string, tagId: string): Promise<void> {
    await this.request(`/tags/${tagId}/subscribers/${subscriberId}`, {
      method: "DELETE",
    });
  }

  /**
   * Filter subscribers by engagement using AND logic across conditions.
   * Condition types: opens, clicks, sent, delivered, subscribed, tags.
   */
  async filterSubscribersByEngagement(body: {
    all: FilterCondition[];
    per_page?: number;
    after?: string;
  }): Promise<any> {
    return this.request("/subscribers/filter", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  // ── Tags ───────────────────────────────────────────────────────────────────

  async listTags(params?: PaginationParams): Promise<any> {
    return this.request(`/tags${this.buildQuery(params ?? {})}`);
  }

  async getTag(id: string): Promise<any> {
    return this.request(`/tags/${id}`);
  }

  async createTag(name: string): Promise<any> {
    return this.request("/tags", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async updateTag(id: string, name: string): Promise<any> {
    return this.request(`/tags/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
  }

  async deleteTag(id: string): Promise<void> {
    await this.request(`/tags/${id}`, {
      method: "DELETE",
    });
  }

  async listTagSubscribers(tagId: string, params?: PaginationParams & { slim?: boolean }): Promise<any> {
    return this.request(`/tags/${tagId}/subscribers${this.buildQuery(params ?? {})}`);
  }

  // ── Sequences ──────────────────────────────────────────────────────────────

  async listSequences(params?: PaginationParams): Promise<any> {
    return this.request(`/sequences${this.buildQuery(params ?? {})}`);
  }

  async getSequence(id: string): Promise<any> {
    return this.request(`/sequences/${id}`);
  }

  async addSubscriberToSequence(sequenceId: string, email: string): Promise<any> {
    return this.request(`/sequences/${sequenceId}/subscribers`, {
      method: "POST",
      body: JSON.stringify({ email_address: email }),
    });
  }

  // ── Broadcasts ─────────────────────────────────────────────────────────────

  async listBroadcasts(params?: PaginationParams & { slim?: boolean }): Promise<any> {
    return this.request(`/broadcasts${this.buildQuery(params ?? {})}`);
  }

  async getBroadcast(id: string): Promise<any> {
    return this.request(`/broadcasts/${id}`);
  }

  /** Stats (recipients, open rate, click rate, etc.) for a single broadcast. */
  async getBroadcastStats(id: string): Promise<any> {
    return this.request(`/broadcasts/${id}/stats`);
  }

  /**
   * Stats for all broadcasts. Includes subject + send_at on each row.
   * Supports date-range filtering via sent_after / sent_before.
   * Note: requires a Pro plan.
   */
  async listBroadcastStats(params?: PaginationParams & {
    sent_after?: string;
    sent_before?: string;
    include_total_count?: boolean;
  }): Promise<any> {
    return this.request(`/broadcasts/stats${this.buildQuery(params ?? {})}`);
  }

  /** Per-URL click breakdown for a broadcast (url, unique_clicks, CTR, CTOR). */
  async getBroadcastLinkClicks(id: string, params?: PaginationParams): Promise<any> {
    return this.request(`/broadcasts/${id}/clicks${this.buildQuery(params ?? {})}`);
  }

  async createBroadcast(data: {
    subject: string;
    content?: string;
    description?: string;
    public?: boolean;
    published_at?: string;
    send_at?: string;
    email_template_id?: string;
    thumbnail_alt?: string;
    thumbnail_url?: string;
    preview_text?: string;
  }): Promise<any> {
    return this.request("/broadcasts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateBroadcast(id: string, data: {
    subject?: string;
    content?: string;
    description?: string;
    public?: boolean;
    published_at?: string;
    send_at?: string;
    email_template_id?: string;
    thumbnail_alt?: string;
    thumbnail_url?: string;
    preview_text?: string;
  }): Promise<any> {
    return this.request(`/broadcasts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteBroadcast(id: string): Promise<void> {
    await this.request(`/broadcasts/${id}`, {
      method: "DELETE",
    });
  }

  // ── Forms ──────────────────────────────────────────────────────────────────

  async listForms(params?: PaginationParams & {
    status?: "active" | "archived" | "trashed" | "all";
  }): Promise<any> {
    return this.request(`/forms${this.buildQuery(params ?? {})}`);
  }

  async getForm(id: string): Promise<any> {
    return this.request(`/forms/${id}`);
  }

  async addSubscriberToForm(formId: string, email: string, data?: {
    first_name?: string;
    fields?: Record<string, string>;
  }): Promise<any> {
    return this.request(`/forms/${formId}/subscribers`, {
      method: "POST",
      body: JSON.stringify({ email_address: email, ...data }),
    });
  }

  // ── Custom Fields ──────────────────────────────────────────────────────────

  async listCustomFields(): Promise<any> {
    return this.request("/custom_fields");
  }

  // ── Webhooks ───────────────────────────────────────────────────────────────

  async listWebhooks(params?: PaginationParams): Promise<any> {
    return this.request(`/webhooks${this.buildQuery(params ?? {})}`);
  }

  async createWebhook(data: {
    target_url: string;
    event: {
      name: string;
      tag_id?: string;
      form_id?: string;
      sequence_id?: string;
      product_id?: string;
    };
  }): Promise<any> {
    return this.request("/webhooks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.request(`/webhooks/${id}`, {
      method: "DELETE",
    });
  }
}
