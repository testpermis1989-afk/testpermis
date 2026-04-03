"use client";

import { useEffect, useCallback } from "react";

export default function ScreenshotProtection() {
  // Vider le clipboard
  const clearClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText("");
    } catch {
      // Clipboard API non supporté
    }
  }, []);

  useEffect(() => {
    // Empêcher le clic droit
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Empêcher les raccourcis clavier
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen — detection forte
      if (e.key === "PrintScreen") {
        e.preventDefault();
        e.stopPropagation();

        // Vider le clipboard immédiatement
        clearClipboard();

        // Masquer tout le contenu
        document.body.style.opacity = "0";
        document.body.style.filter = "blur(20px)";

        // Vider le clipboard plusieurs fois (car le screenshot peut prendre du temps)
        setTimeout(() => clearClipboard(), 50);
        setTimeout(() => clearClipboard(), 100);
        setTimeout(() => clearClipboard(), 200);
        setTimeout(() => clearClipboard(), 500);

        // Restaurer après un délai
        setTimeout(() => {
          document.body.style.opacity = "1";
          document.body.style.filter = "none";
        }, 1000);

        return false;
      }

      // Ctrl+S, Ctrl+U, Ctrl+P, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (e.ctrlKey || e.metaKey) {
        if (
          e.key === "s" ||
          e.key === "u" ||
          e.key === "p" ||
          (e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c"))
        ) {
          e.preventDefault();
          return false;
        }
      }

      // F12
      if (e.key === "F12") {
        e.preventDefault();
        return false;
      }
    };

    // Detecter quand le contenu est copié
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      clearClipboard();
      return false;
    };

    // Empêcher le drag
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("copy", handleCopy, true);
    document.addEventListener("dragstart", handleDragStart);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("copy", handleCopy, true);
      document.removeEventListener("dragstart", handleDragStart);
    };
  }, [clearClipboard]);

  return null;
}
