import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface ModalOptions {
  title: string;
  body: ReactNode;
  dismissLabel?: string;
  actions?: ReactNode;
}

interface ModalContextValue {
  openModal: (options: ModalOptions) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalOptions | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!modal) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    dialog.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (openerRef.current?.isConnected) openerRef.current.focus();
    };
  }, [modal]);

  const closeModal = useCallback(() => setModal(null), []);
  const openModal = useCallback((options: ModalOptions) => {
    if (!dialogRef.current?.open) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    setModal(options);
  }, []);

  const value = useMemo(
    () => ({ openModal, closeModal }),
    [openModal, closeModal],
  );

  const modalRoot = document.getElementById("modal-root");

  return (
    <ModalContext.Provider value={value}>
      {children}
      {modal && modalRoot
        ? createPortal(
              <dialog
                ref={dialogRef}
                tabIndex={-1}
                className="modal-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="global-modal-title"
                onCancel={(event) => { event.preventDefault(); closeModal(); }}
                onKeyDown={(event) => {
                  if (event.key !== "Tab") return;
                  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
                    'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
                  )).filter((element) => element.getClientRects().length > 0 && element.tabIndex >= 0);
                  const first = controls[0];
                  const last = controls[controls.length - 1];
                  if (!first) { event.preventDefault(); return; }
                  if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
                    event.preventDefault(); last.focus();
                  } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault(); first.focus();
                  }
                }}
                onClick={(event) => {
                  if (event.target !== event.currentTarget) return;
                  const bounds = event.currentTarget.getBoundingClientRect();
                  if (event.clientX < bounds.left || event.clientX > bounds.right ||
                      event.clientY < bounds.top || event.clientY > bounds.bottom) closeModal();
                }}
              >
                <header className="panel-heading">
                  <strong id="global-modal-title">{modal.title}</strong>
                  <button className="icon-button" type="button" aria-label="Close dialog" onClick={closeModal}>×</button>
                </header>
                <div className="modal-body">{modal.body}</div>
                <footer className="modal-footer">
                  {modal.actions ?? (
                    <button className="button button-primary" type="button" onClick={closeModal}>
                      {modal.dismissLabel ?? "CLOSE"}
                    </button>
                  )}
                </footer>
              </dialog>,
            modalRoot,
          )
        : null}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);

  if (!context) {
    throw new Error("useModal must be used inside ModalProvider.");
  }

  return context;
}
