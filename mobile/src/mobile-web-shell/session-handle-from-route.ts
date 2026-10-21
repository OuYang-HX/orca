/**
 * The terminal handle a session route names.
 *
 * Mobile routes carry `${repoId}::${path}` encoded in their own segment, which is exactly the
 * handle the terminal RPCs take. Decoding here keeps the percent-encoding of the document URL out
 * of the caller.
 */
export function sessionHandleFromPathname(pathname: string): string | null {
  const marker = '/session/'
  const index = pathname.indexOf(marker)
  if (index === -1) {
    return null
  }
  const rest = pathname.slice(index + marker.length)
  const segment = rest.split('/')[0].split('?')[0]
  if (!segment) {
    return null
  }
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}
