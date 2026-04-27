import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BASE_DELAY_MS = 750;

function clampBatchSize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(DEFAULT_BATCH_SIZE, Math.floor(parsed)));
}

function getBatchSize() {
  return clampBatchSize(process.env.RESEND_BATCH_SIZE);
}

function getMaxAttempts() {
  const parsed = Number(process.env.RESEND_MAX_RETRY_ATTEMPTS);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_ATTEMPTS;
  return Math.max(1, Math.floor(parsed));
}

function getBaseDelayMs() {
  const parsed = Number(process.env.RESEND_RETRY_BASE_DELAY_MS);
  if (!Number.isFinite(parsed)) return DEFAULT_BASE_DELAY_MS;
  return Math.max(100, Math.floor(parsed));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function normalizeRecipients(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }

  const single = String(value || "").trim();
  return single ? [single] : [];
}

function extractPrimaryRecipient(message) {
  return normalizeRecipients(message?.to)[0] || "unknown-recipient";
}

function isRateLimitError(error) {
  const statusCode = Number(error?.statusCode || error?.status || error?.error?.statusCode || 0);
  const message = String(error?.message || error?.error || "");
  return statusCode === 429 || message.includes("429") || /rate limit/i.test(message);
}

function formatErrorMessage(error) {
  if (!error) return "Unknown email send error.";
  return String(error?.message || error?.error || error);
}

async function sendBatchWithRetry(messages) {
  const maxAttempts = getMaxAttempts();
  const baseDelayMs = getBaseDelayMs();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await resend.batch.send(messages);

    if (!result?.error) {
      return result;
    }

    if (!isRateLimitError(result.error) || attempt === maxAttempts) {
      return result;
    }

    const jitterMs = Math.floor(Math.random() * 250);
    const delayMs = (baseDelayMs * (2 ** (attempt - 1))) + jitterMs;
    await sleep(delayMs);
  }

  return {
    data: null,
    error: { message: "Email batch retry loop exited unexpectedly." },
  };
}

export function getDefaultEmailSender() {
  const fromEmail = String(process.env.RESEND_FROM_EMAIL || "noreply@nctrecycling.com").trim();
  const fromName = String(process.env.RESEND_FROM_NAME || "NCT Recycling").trim();
  const replyTo = String(process.env.RESEND_REPLY_TO || "").trim();

  return {
    from: `${fromName} <${fromEmail}>`,
    replyTo: replyTo || undefined,
  };
}

export async function sendBulkEmails(messages) {
  const validMessages = Array.isArray(messages)
    ? messages.filter((message) => normalizeRecipients(message?.to).length > 0)
    : [];

  if (validMessages.length === 0) {
    return { sent: 0, failed: 0, errors: [] };
  }

  const errors = [];
  let sent = 0;

  const chunks = chunkArray(validMessages, getBatchSize());

  for (const chunk of chunks) {
    const { error } = await sendBatchWithRetry(chunk);

    if (error) {
      const message = formatErrorMessage(error);
      errors.push(
        ...chunk.map((entry) => ({
          email: extractPrimaryRecipient(entry),
          error: message,
        }))
      );
      continue;
    }

    sent += chunk.length;
  }

  return {
    sent,
    failed: errors.length,
    errors,
  };
}