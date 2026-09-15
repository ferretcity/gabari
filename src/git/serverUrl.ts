/** Shared host-normalization for a self-hosted GitHub/GitLab instance -
 * used by `github.ts`, `gitlab.ts`, and `gitlabAuth.ts` so this one bit
 * of forgiving-input logic lives in exactly one place. `''` throughout
 * this app's `serverUrl` fields means "use the public host" - callers
 * check for that themselves rather than this function inventing a
 * default, since github.com and gitlab.com resolve to different bases
 * (api.github.com vs gitlab.com/api/v4) that only each provider's own
 * client knows how to build. */
export function normalizeServerUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}
