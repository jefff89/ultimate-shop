const apiUrl = () => {
  const url = process.env.API_URL
  if (!url) {
    // Fail loudly: an empty base would make every call a relative URL that
    // throws on the server and gets silently swallowed, surfacing only as
    // "everyone is logged out" with no diagnostic.
    throw new Error('API_URL is not set — the backend base URL is required.')
  }
  return url
}

const cookieHeader = (
  req: Request | null | undefined,
): Record<string, string> => {
  const cookie = req?.headers.get('cookie')
  return cookie ? { cookie } : {}
}

export async function get(
  path: string,
  req: Request | null | undefined,
): Promise<Response> {
  return fetch(`${apiUrl()}/${path}`, {
    headers: { ...cookieHeader(req) },
  })
}

export async function post(
  path: string,
  body: unknown,
  req: Request | null | undefined,
): Promise<Response> {
  return fetch(`${apiUrl()}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cookieHeader(req) },
    body: JSON.stringify(body),
  })
}
