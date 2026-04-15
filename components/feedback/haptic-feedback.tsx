"use client";

import * as React from "react";

type HapticStrength = "light" | "medium" | "rigid" | "success";

type TelegramHapticFeedback = {
  impactOccurred?: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  notificationOccurred?: (type: "error" | "success" | "warning") => void;
  selectionChanged?: () => void;
};

type TelegramWebApp = {
  HapticFeedback?: TelegramHapticFeedback;
};

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
};

function triggerHaptic(strength: HapticStrength) {
  if (typeof window === "undefined") {
    return;
  }

  const telegramWindow = window as TelegramWindow;
  const feedback = telegramWindow.Telegram?.WebApp?.HapticFeedback;

  if (feedback) {
    if (strength === "success") {
      feedback.notificationOccurred?.("success");
      return;
    }

    feedback.impactOccurred?.(strength);
    return;
  }

  if (!window.matchMedia("(pointer: coarse)").matches) {
    return;
  }

  if (!("vibrate" in navigator)) {
    return;
  }

  const duration =
    strength === "medium" ? 14 : strength === "rigid" ? 18 : 10;

  navigator.vibrate(duration);
}

export function HapticFeedback() {
  React.useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const trigger = target?.closest<HTMLElement>("[data-haptic], [data-slot='button']");

      if (!trigger) {
        return;
      }

      if (trigger.getAttribute("aria-disabled") === "true") {
        return;
      }

      const dataStrength = trigger.dataset.haptic;
      const strength =
        dataStrength === "medium" ||
        dataStrength === "rigid" ||
        dataStrength === "success"
          ? dataStrength
          : "light";

      triggerHaptic(strength);
    }

    document.addEventListener("click", onClick, { passive: true });

    return () => {
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
