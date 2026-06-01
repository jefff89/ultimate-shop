// Use this for any <img src> whose URL is controlled by user input or backend data.
// Rejects javascript:, blob:, file:, and other non-image schemes.
// Allowed: same-origin paths (start with '/'), https:, and data:image/*.
// Pass `allowedHosts` to further restrict https URLs to a CDN/storage allowlist.

import type { ImgHTMLAttributes } from 'react'

type SafeImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string | null | undefined
  allowedHosts?: ReadonlyArray<string>
  fallback?: string
}

function isSafeImageSrc(
  src: string,
  allowedHosts?: ReadonlyArray<string>,
): boolean {
  if (src.startsWith('/') && !src.startsWith('//')) return true
  if (src.startsWith('data:image/')) return true
  try {
    const url = new URL(src)
    if (url.protocol !== 'https:') return false
    if (allowedHosts && !allowedHosts.includes(url.host)) return false
    return true
  } catch {
    return false
  }
}

export default function SafeImage({
  src,
  allowedHosts,
  fallback,
  alt = '',
  ...rest
}: SafeImageProps) {
  const resolved =
    src && isSafeImageSrc(src, allowedHosts) ? src : (fallback ?? null)
  if (!resolved) return null
  return <img src={resolved} alt={alt} {...rest} />
}
