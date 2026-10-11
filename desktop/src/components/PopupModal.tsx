/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG,
 * RUAN VAN ZYL
 *
 * File Function:
 * Accessible modal dialog used by every popup in the app. On open it focuses the
 * first input (or button), Tab and Shift+Tab stay inside the dialog, and focus
 * returns to the previous element on close. Clicking the backdrop or the X button
 * calls onClose.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Props for PopupModal. */
interface PopupModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Renders a titled modal around its children. */
export default function PopupModal({ title, onClose, children }: PopupModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const element = ref.current;

    const focusables = () =>
      Array.from(
        element?.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [tabindex="0"]',
        ) ?? [],
      ).filter(node => !node.hasAttribute('disabled'));

    const input = element?.querySelector<HTMLElement>('[autofocus], input, textarea');
    (input ?? focusables()[0])?.focus();

    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    element?.addEventListener('keydown', trap);

    return () => {
      element?.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="modal" ref={ref} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="modal-close icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={19} />
        </button>

        <h2 id="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}