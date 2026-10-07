import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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

  const closeModal = useCallback(() => setModal(null), []);
  const openModal = useCallback((options: ModalOptions) => setModal(options), []);

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
            <div className="modal-backdrop" role="presentation" onMouseDown={closeModal}>
              <section
                className="modal-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="global-modal-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <header className="panel-heading">
                  <strong id="global-modal-title">{modal.title}</strong>
                  <button className="icon-button" type="button" onClick={closeModal}>×</button>
                </header>
                <div className="modal-body">{modal.body}</div>
                <footer className="modal-footer">
                  {modal.actions ?? (
                    <button className="button button-primary" type="button" onClick={closeModal}>
                      {modal.dismissLabel ?? "CLOSE"}
                    </button>
                  )}
                </footer>
              </section>
            </div>,
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
