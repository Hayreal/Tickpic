export function resolveOpenAIBaseURL(): string | undefined {
  const rawBaseURL = process.env.LLM_BASE_URL ?? process.env.OPENAI_BASE_URL;
  if (!rawBaseURL) {
    return undefined;
  }

  const trimmedBaseURL = rawBaseURL.trim().replace(/\/+$/, "");
  if (!trimmedBaseURL) {
    return undefined;
  }

  return /\/v\d+$/i.test(trimmedBaseURL) ? trimmedBaseURL : `${trimmedBaseURL}/v1`;
}
