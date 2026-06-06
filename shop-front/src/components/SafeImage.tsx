// Use this for any <img src> whose URL is controlled by user input or backend data.
// Rejects javascript:, blob:, file:, and other non-image schemes.
// Allowed: same-origin paths (start with '/'), https:, and data:image/*.
// Pass `allowedHosts` to further restrict https URLs to a CDN/storage allowlist.
//
// On a load failure (onError) of an otherwise scheme-valid URL — or when the src
// fails scheme validation and no `fallback` is supplied — a neutral muted-icon
// box is rendered in the SAME reserved dimensions, so the loaded -> fallback swap
// is zero-CLS and the browser's broken-image glyph never appears (MOT-02).

import { ImageOff } from 'lucide-react'
import { useState } from 'react'
import type { CSSProperties, ImgHTMLAttributes } from 'react'

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
  className,
  width,
  height,
  ...rest
}: SafeImageProps) {
  const [errored, setErrored] = useState(false)

  const resolved =
    src && isSafeImageSrc(src, allowedHosts) ? src : (fallback ?? null)

  // Fallback render: scheme-invalid (and no fallback) OR a load error fired.
  // Reserve the SAME box (explicit width/height when given, else fill the
  // aspect-square well via h-full w-full) so the swap is zero-CLS. The icon is
  // purely decorative; the alt is exposed to assistive tech on the box.
  if (!resolved || errored) {
    const style: CSSProperties | undefined =
      width != null || height != null
        ? {
            width: width != null ? Number(width) : undefined,
            height: height != null ? Number(height) : undefined,
          }
        : undefined
    return (
      <div
        role="img"
        aria-label={alt}
        style={style}
        className={`flex items-center justify-center bg-zinc-100 ${
          style ? '' : 'h-full w-full'
        } ${className ?? ''}`.trim()}
      >
        <ImageOff
          aria-hidden="true"
          className="h-1/4 w-1/4 text-muted-foreground"
        />
      </div>
    )
  }

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      width={width}
      height={height}
      onError={() => setErrored(true)}
      {...rest}
    />
  )
}
