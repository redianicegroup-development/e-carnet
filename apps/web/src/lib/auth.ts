export function safeOAuthNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) {
    return "/patient";
  }

  try {
    return new URL(value, "https://ecarnet.invalid").origin === "https://ecarnet.invalid"
      ? value
      : "/patient";
  } catch {
    return "/patient";
  }
}
