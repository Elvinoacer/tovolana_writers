"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TICK_MS = 4200;
const LIVE_ATTR = "data-hud-live";

/**
 * Performance-first neon conductor.
 *
 * Every `.hud-card` keeps its decorative animations paused at rest (see
 * globals.css). This sequencer lights only the cards currently on screen, one
 * (or two when many are visible) at a time, handing the glow along in reading
 * order every ~4.2s. Off-screen cards, hidden tabs, and reduced-motion users
 * never animate. Hover / focus always brings a card to life via CSS.
 */
export function HudLiveSequencer() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const visible = new Set<Element>();
    const observed = new WeakSet<Element>();
    let cursor = 0;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.add(entry.target);
          } else {
            visible.delete(entry.target);
            entry.target.removeAttribute(LIVE_ATTR);
          }
        }
      },
      { threshold: 0.35 }
    );

    const scan = () => {
      document.querySelectorAll(".hud-card").forEach((el) => {
        if (!observed.has(el)) {
          observed.add(el);
          io.observe(el);
        }
      });
    };

    const tick = () => {
      if (document.hidden) return;
      scan();

      const list = Array.from(visible)
        .filter((el) => el.isConnected)
        .sort((a, b) =>
          a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        );

      document
        .querySelectorAll(`[${LIVE_ATTR}]`)
        .forEach((el) => el.removeAttribute(LIVE_ATTR));

      if (list.length === 0) return;

      const slots = list.length > 3 ? 2 : 1;
      const stride = Math.ceil(list.length / slots);
      for (let i = 0; i < slots; i += 1) {
        list[(cursor + i * stride) % list.length].setAttribute(LIVE_ATTR, "on");
      }
      cursor = (cursor + 1) % list.length;
    };

    scan();
    // Let the observer report initial visibility before the first hand-off.
    const startTimer = window.setTimeout(tick, 350);
    const interval = window.setInterval(tick, TICK_MS);

    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(interval);
      io.disconnect();
      document
        .querySelectorAll(`[${LIVE_ATTR}]`)
        .forEach((el) => el.removeAttribute(LIVE_ATTR));
    };
  }, [pathname]);

  return null;
}
