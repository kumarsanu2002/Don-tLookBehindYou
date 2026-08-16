export function isTouchDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return navigator.maxTouchPoints > 0 || (window.matchMedia?.('(pointer: coarse)').matches ?? false)
}
