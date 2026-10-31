export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Calls the MatchMe API (proxied to the server in development). Throws ApiError on failure. */
export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Can’t reach the MatchMe server. Is it running (npm run dev)?', 0)
  }
  const isJson = res.headers.get('Content-Type')?.includes('application/json')
  const data = (isJson ? await res.json().catch(() => null) : null) as (T & { error?: string }) | null
  if (!isJson || [502, 503, 504].includes(res.status)) {
    // An HTML page or gateway error means the request never reached the MatchMe API.
    throw new ApiError(
      data?.error ??
        'Can’t reach the MatchMe API server, so nothing was saved. Start everything with `npm run dev` (it runs both the website and the API), then try again.',
      res.status || 503,
    )
  }
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status}).`, res.status)
  return data as T
}
