const getHeaders = (request) => ({
  Cookie: request?.headers?.get('cookie'),
})

export const post = async (path: string, formData: FormData, req) => {
  const res = await fetch(`${process.env.API_URL}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getHeaders(req) },
    // headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  })
  return res
  //   const parsedRes = await res.json()
  //   if (!res.ok) {
  //     return { error: getParseErrorMessage(parsedRes) }
  //   }
  //   return { error: '' }
}

export const get = async (path: string, req) => {
  const res = await fetch(`${process.env.API_URL}/${path}`, {
    headers: { ...getHeaders(req) },
  })
  return res.json()
}
