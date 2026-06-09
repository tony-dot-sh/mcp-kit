#!/usr/bin/env node

/**
 * Kit.com MCP Server
 * Provides MCP tools for interacting with the Kit.com (ConvertKit) API
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { KitClient } from "./kit-client.js";

// Get API key from environment
const apiKey = process.env.KIT_API_KEY;
if (!apiKey) {
  console.error("Error: KIT_API_KEY environment variable is required");
  process.exit(1);
}

const client = new KitClient({ apiKey });

const server = new McpServer({
  name: "mcp-kit",
  version: "1.0.0",
});

// Helper to format responses
function formatResponse(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function formatError(error: unknown): { content: Array<{ type: "text"; text: string }>; isError: true } {
  return {
    content: [
      {
        type: "text" as const,
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      },
    ],
    isError: true,
  };
}

// ==================== ACCOUNT ====================

server.tool(
  "kit_get_account",
  "Get information about the Kit.com account",
  {},
  async () => {
    try {
      const result = await client.getAccount();
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

// ==================== SUBSCRIBERS ====================

server.tool(
  "kit_list_subscribers",
  "List subscribers from Kit.com with optional filters. Returns paginated results.",
  {
    status: z.enum(["active", "inactive", "bounced", "complained", "cancelled", "all"]).optional()
      .describe("Filter by subscriber status. Defaults to 'active'."),
    email_address: z.string().optional()
      .describe("Filter by email address. Accepts a single email or comma-separated list for multi-lookup (e.g. 'a@example.com,b@example.com')."),
    created_after: z.string().optional().describe("Filter subscribers created after this date (YYYY-MM-DD or ISO datetime)"),
    created_before: z.string().optional().describe("Filter subscribers created before this date (YYYY-MM-DD or ISO datetime)"),
    updated_after: z.string().optional().describe("Filter subscribers updated after this date"),
    updated_before: z.string().optional().describe("Filter subscribers updated before this date"),
    sort_field: z.enum(["created_at", "updated_at"]).optional().describe("Field to sort by"),
    sort_order: z.enum(["asc", "desc"]).optional().describe("Sort order"),
    include: z.string().optional()
      .describe("Comma-separated extra fields to include: attribution, tags, location, canceled_at"),
    slim: z.boolean().optional()
      .describe("When true, omits expensive fields for a faster smaller response"),
    per_page: z.number().optional().describe("Number of results per page (max 1000)"),
    after: z.string().optional().describe("Cursor for pagination"),
  },
  async (params) => {
    try {
      const result = await client.listSubscribers(params);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_get_subscriber",
  "Get a specific subscriber by ID",
  {
    subscriber_id: z.string().describe("The subscriber ID"),
  },
  async ({ subscriber_id }) => {
    try {
      const result = await client.getSubscriber(subscriber_id);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_create_subscriber",
  "Create a new subscriber in Kit.com",
  {
    email_address: z.string().email().describe("The subscriber's email address"),
    first_name: z.string().optional().describe("The subscriber's first name"),
    state: z.enum(["active", "inactive"]).optional().describe("Subscriber state (default: active)"),
    fields: z.record(z.string()).optional().describe("Custom field values as key-value pairs"),
  },
  async (params) => {
    try {
      const result = await client.createSubscriber(params);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_update_subscriber",
  "Update an existing subscriber",
  {
    subscriber_id: z.string().describe("The subscriber ID to update"),
    email_address: z.string().email().optional().describe("New email address"),
    first_name: z.string().optional().describe("New first name"),
    fields: z.record(z.string()).optional().describe("Custom field values to update"),
  },
  async ({ subscriber_id, ...data }) => {
    try {
      const result = await client.updateSubscriber(subscriber_id, data);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_get_subscriber_tags",
  "Get all tags for a specific subscriber",
  {
    subscriber_id: z.string().describe("The subscriber ID"),
  },
  async ({ subscriber_id }) => {
    try {
      const result = await client.getSubscriberTags(subscriber_id);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_add_tag_to_subscriber",
  "Add a tag to a subscriber",
  {
    subscriber_id: z.string().describe("The subscriber ID"),
    tag_id: z.string().describe("The tag ID to add"),
  },
  async ({ subscriber_id, tag_id }) => {
    try {
      const result = await client.addTagToSubscriber(subscriber_id, tag_id);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_remove_tag_from_subscriber",
  "Remove a tag from a subscriber",
  {
    subscriber_id: z.string().describe("The subscriber ID"),
    tag_id: z.string().describe("The tag ID to remove"),
  },
  async ({ subscriber_id, tag_id }) => {
    try {
      await client.removeTagFromSubscriber(subscriber_id, tag_id);
      return formatResponse({ success: true, message: "Tag removed from subscriber" });
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_get_subscriber_by_email",
  "Look up a Kit subscriber by their email address. Returns subscriber ID, state, name, and custom fields. Use this when you have an email from another system (e.g. Follow Up Boss) and need the Kit subscriber record.",
  {
    email: z.string().email().describe("The subscriber's email address"),
  },
  async ({ email }) => {
    try {
      const result = await client.getSubscriberByEmail(email);
      const subscribers = result?.subscribers ?? [];
      if (subscribers.length === 0) {
        return formatResponse({ found: false, message: `No Kit subscriber found for ${email}` });
      }
      return formatResponse({ found: true, subscriber: subscribers[0] });
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_get_subscriber_stats",
  "Get email engagement stats for a subscriber: sends, opens, clicks, bounce, open rate, click rate, last activity dates, and sends since last open/click. Data available from June 2025 onward. Optionally filter to a date range.",
  {
    subscriber_id: z.string().describe("The subscriber ID"),
    email_sent_after: z.string().optional()
      .describe("Only include stats for emails sent after this date (YYYY-MM-DD)"),
    email_sent_before: z.string().optional()
      .describe("Only include stats for emails sent before this date (YYYY-MM-DD)"),
  },
  async ({ subscriber_id, email_sent_after, email_sent_before }) => {
    try {
      const result = await client.getSubscriberStats(subscriber_id, {
        email_sent_after,
        email_sent_before,
      });
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_unsubscribe_subscriber",
  "Unsubscribe a subscriber from Kit (sets their state to cancelled).",
  {
    subscriber_id: z.string().describe("The subscriber ID to unsubscribe"),
  },
  async ({ subscriber_id }) => {
    try {
      const result = await client.unsubscribeSubscriber(subscriber_id);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_filter_subscribers_by_engagement",
  "Filter subscribers using AND logic across engagement conditions. Condition types: opens, clicks, sent, delivered, subscribed, tags. Each condition can have count thresholds (count_greater_than, count_less_than) and date ranges (after, before as YYYY-MM-DD). Clicks and opens can further filter by specific broadcast IDs or URLs using the 'any' array. Tags conditions use 'any' with {type:'ids', matching:[id1,id2]}. Example: find subscribers who opened more than 3 times in the last 90 days.",
  {
    conditions: z.array(z.object({
      type: z.enum(["opens", "clicks", "sent", "delivered", "subscribed", "tags"])
        .describe("Type of engagement event to filter on"),
      count_greater_than: z.number().optional().describe("Minimum event count (exclusive)"),
      count_less_than: z.number().optional().describe("Maximum event count (exclusive)"),
      after: z.string().optional().describe("Start date YYYY-MM-DD"),
      before: z.string().optional().describe("End date YYYY-MM-DD"),
      any: z.array(z.any()).optional()
        .describe("OR sub-conditions: [{type:'broadcasts',ids:[1,2]}, {type:'urls',urls:['example.com'],matching:'contains'}, {type:'ids',matching:[tagId1]}]"),
    })).describe("ALL of these conditions must be met (AND logic)"),
    per_page: z.number().optional().describe("Results per page"),
    after: z.string().optional().describe("Pagination cursor"),
  },
  async ({ conditions, per_page, after }) => {
    try {
      const result = await client.filterSubscribersByEngagement({
        all: conditions,
        per_page,
        after,
      });
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

// ==================== TAGS ====================

server.tool(
  "kit_list_tags",
  "List all tags in Kit.com",
  {
    per_page: z.number().optional().describe("Number of results per page"),
    after: z.string().optional().describe("Cursor for pagination"),
  },
  async (params) => {
    try {
      const result = await client.listTags(params);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_get_tag",
  "Get a specific tag by ID",
  {
    tag_id: z.string().describe("The tag ID"),
  },
  async ({ tag_id }) => {
    try {
      const result = await client.getTag(tag_id);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_create_tag",
  "Create a new tag in Kit.com",
  {
    name: z.string().describe("The name for the new tag"),
  },
  async ({ name }) => {
    try {
      const result = await client.createTag(name);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_update_tag",
  "Update an existing tag's name",
  {
    tag_id: z.string().describe("The tag ID to update"),
    name: z.string().describe("The new name for the tag"),
  },
  async ({ tag_id, name }) => {
    try {
      const result = await client.updateTag(tag_id, name);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_delete_tag",
  "Delete a tag from Kit.com",
  {
    tag_id: z.string().describe("The tag ID to delete"),
  },
  async ({ tag_id }) => {
    try {
      await client.deleteTag(tag_id);
      return formatResponse({ success: true, message: "Tag deleted" });
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_list_tag_subscribers",
  "List all subscribers with a specific tag",
  {
    tag_id: z.string().describe("The tag ID"),
    per_page: z.number().optional().describe("Number of results per page"),
    after: z.string().optional().describe("Cursor for pagination"),
  },
  async ({ tag_id, ...params }) => {
    try {
      const result = await client.listTagSubscribers(tag_id, params);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

// ==================== SEQUENCES ====================

server.tool(
  "kit_list_sequences",
  "List all email sequences in Kit.com",
  {
    per_page: z.number().optional().describe("Number of results per page"),
    after: z.string().optional().describe("Cursor for pagination"),
  },
  async (params) => {
    try {
      const result = await client.listSequences(params);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_get_sequence",
  "Get a specific sequence by ID",
  {
    sequence_id: z.string().describe("The sequence ID"),
  },
  async ({ sequence_id }) => {
    try {
      const result = await client.getSequence(sequence_id);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_add_subscriber_to_sequence",
  "Add a subscriber to an email sequence",
  {
    sequence_id: z.string().describe("The sequence ID"),
    email: z.string().email().describe("The subscriber's email address"),
  },
  async ({ sequence_id, email }) => {
    try {
      const result = await client.addSubscriberToSequence(sequence_id, email);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

// ==================== BROADCASTS ====================

server.tool(
  "kit_list_broadcasts",
  "List all broadcasts (email campaigns) in Kit.com",
  {
    per_page: z.number().optional().describe("Number of results per page"),
    after: z.string().optional().describe("Cursor for pagination"),
  },
  async (params) => {
    try {
      const result = await client.listBroadcasts(params);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_get_broadcast",
  "Get a specific broadcast by ID",
  {
    broadcast_id: z.string().describe("The broadcast ID"),
  },
  async ({ broadcast_id }) => {
    try {
      const result = await client.getBroadcast(broadcast_id);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_create_broadcast",
  "Create a new broadcast (email campaign) in Kit.com",
  {
    subject: z.string().describe("The email subject line"),
    content: z.string().optional().describe("The email content (HTML supported)"),
    description: z.string().optional().describe("Internal description for the broadcast"),
    public: z.boolean().optional().describe("Whether the broadcast should be public"),
    preview_text: z.string().optional().describe("Preview text shown in email clients"),
    send_at: z.string().optional().describe("ISO date when to send the broadcast"),
  },
  async (params) => {
    try {
      const result = await client.createBroadcast(params);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_update_broadcast",
  "Update an existing broadcast",
  {
    broadcast_id: z.string().describe("The broadcast ID to update"),
    subject: z.string().optional().describe("New subject line"),
    content: z.string().optional().describe("New content"),
    description: z.string().optional().describe("New description"),
    public: z.boolean().optional().describe("Whether the broadcast should be public"),
    preview_text: z.string().optional().describe("New preview text"),
    send_at: z.string().optional().describe("New send time (ISO date)"),
  },
  async ({ broadcast_id, ...data }) => {
    try {
      const result = await client.updateBroadcast(broadcast_id, data);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_delete_broadcast",
  "Delete a broadcast from Kit.com",
  {
    broadcast_id: z.string().describe("The broadcast ID to delete"),
  },
  async ({ broadcast_id }) => {
    try {
      await client.deleteBroadcast(broadcast_id);
      return formatResponse({ success: true, message: "Broadcast deleted" });
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_get_broadcast_stats",
  "Get performance stats for a single broadcast: recipients, open rate, emails opened, click rate, unsubscribes, total clicks, send status, and tracking settings.",
  {
    broadcast_id: z.string().describe("The broadcast ID"),
  },
  async ({ broadcast_id }) => {
    try {
      const result = await client.getBroadcastStats(broadcast_id);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_list_broadcast_stats",
  "Get stats for all broadcasts including subject and send date on each row — useful for campaign performance analysis without needing separate lookups. Supports date-range filtering. Note: requires a Kit Pro plan.",
  {
    sent_after: z.string().optional()
      .describe("Only include broadcasts sent after this date (ISO datetime)"),
    sent_before: z.string().optional()
      .describe("Only include broadcasts sent before this date (ISO datetime)"),
    per_page: z.number().optional().describe("Results per page (default 500, max 1000)"),
    after: z.string().optional().describe("Pagination cursor"),
    include_total_count: z.boolean().optional()
      .describe("Include total count in response (slower — only request on first page)"),
  },
  async (params) => {
    try {
      const result = await client.listBroadcastStats(params);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_get_broadcast_link_clicks",
  "Get per-URL click breakdown for a broadcast: each tracked link with unique click count, click-to-delivery rate, and click-to-open rate.",
  {
    broadcast_id: z.string().describe("The broadcast ID"),
    per_page: z.number().optional().describe("Results per page"),
    after: z.string().optional().describe("Pagination cursor"),
  },
  async ({ broadcast_id, per_page, after }) => {
    try {
      const result = await client.getBroadcastLinkClicks(broadcast_id, { per_page, after });
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

// ==================== FORMS ====================

server.tool(
  "kit_list_forms",
  "List all forms in Kit.com",
  {
    status: z.enum(["active", "archived", "trashed", "all"]).optional()
      .describe("Filter by form status"),
    per_page: z.number().optional().describe("Number of results per page"),
    after: z.string().optional().describe("Cursor for pagination"),
  },
  async (params) => {
    try {
      const result = await client.listForms(params);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_get_form",
  "Get a specific form by ID",
  {
    form_id: z.string().describe("The form ID"),
  },
  async ({ form_id }) => {
    try {
      const result = await client.getForm(form_id);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_add_subscriber_to_form",
  "Add a subscriber to a form (creates subscriber if doesn't exist)",
  {
    form_id: z.string().describe("The form ID"),
    email: z.string().email().describe("The subscriber's email address"),
    first_name: z.string().optional().describe("The subscriber's first name"),
    fields: z.record(z.string()).optional().describe("Custom field values"),
  },
  async ({ form_id, email, ...data }) => {
    try {
      const result = await client.addSubscriberToForm(form_id, email, data);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

// ==================== CUSTOM FIELDS ====================

server.tool(
  "kit_list_custom_fields",
  "List all custom fields defined in Kit.com",
  {},
  async () => {
    try {
      const result = await client.listCustomFields();
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

// ==================== WEBHOOKS ====================

server.tool(
  "kit_list_webhooks",
  "List all webhooks configured in Kit.com",
  {
    per_page: z.number().optional().describe("Number of results per page"),
    after: z.string().optional().describe("Cursor for pagination"),
  },
  async (params) => {
    try {
      const result = await client.listWebhooks(params);
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_create_webhook",
  "Create a new webhook in Kit.com",
  {
    target_url: z.string().url().describe("The URL to receive webhook events"),
    event_name: z.string().describe("The event name (e.g., subscriber.subscriber_activate)"),
    tag_id: z.string().optional().describe("Tag ID for tag-specific events"),
    form_id: z.string().optional().describe("Form ID for form-specific events"),
    sequence_id: z.string().optional().describe("Sequence ID for sequence-specific events"),
  },
  async ({ target_url, event_name, tag_id, form_id, sequence_id }) => {
    try {
      const result = await client.createWebhook({
        target_url,
        event: {
          name: event_name,
          tag_id,
          form_id,
          sequence_id,
        },
      });
      return formatResponse(result);
    } catch (error) {
      return formatError(error);
    }
  }
);

server.tool(
  "kit_delete_webhook",
  "Delete a webhook from Kit.com",
  {
    webhook_id: z.string().describe("The webhook ID to delete"),
  },
  async ({ webhook_id }) => {
    try {
      await client.deleteWebhook(webhook_id);
      return formatResponse({ success: true, message: "Webhook deleted" });
    } catch (error) {
      return formatError(error);
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Kit.com MCP server started");
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
