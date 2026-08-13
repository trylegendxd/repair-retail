const MAX_JSON_SIZE = 10_000; // 10KB limit for JSON fields
const MAX_MESSAGE_SIZE = 2_000;

export function validateJson(value: unknown, maxBytes: number = MAX_JSON_SIZE): string {
  const json = JSON.stringify(value);
  if (json.length > maxBytes) {
    throw new Error(`JSON payload exceeds ${maxBytes} bytes (got ${json.length})`);
  }
  return json;
}

export function validateMessage(value: string, maxBytes: number = MAX_MESSAGE_SIZE): string {
  if (value.length > maxBytes) {
    throw new Error(`Message exceeds ${maxBytes} characters`);
  }
  return value;
}
