export function createId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2);
  return `${prefix}-${timestamp}-${random}`;
}
