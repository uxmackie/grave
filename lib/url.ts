export function safeUrl(url: string) {
  const value = url.trim();
  return /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(value) &&
    !/[\u0000-\u001f\\]/.test(value)
    ? value
    : "#";
}
