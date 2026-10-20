import * as React from "react"

const MOBILE_BREAKPOINT = 768
const TABLET_BREAKPOINT = 1024

function subscribeViewport(callback: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener("resize", callback)
  return () => window.removeEventListener("resize", callback)
}

export function useIsMobile(): boolean {
  return React.useSyncExternalStore(
    subscribeViewport,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false
  )
}

export function useLowPowerDevice(): boolean {
  return React.useSyncExternalStore(
    subscribeViewport,
    () => {
      const isSmallViewport = window.innerWidth < MOBILE_BREAKPOINT
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
      const veryLowCores =
        typeof navigator !== "undefined" &&
        typeof navigator.hardwareConcurrency === "number" &&
        navigator.hardwareConcurrency <= 2

      return isSmallViewport || prefersReducedMotion || veryLowCores
    },
    () => false
  )
}
