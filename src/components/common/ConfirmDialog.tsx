import React from "react";
import { Modal } from "./Modal";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "primary";
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
}) => {
  const buttonColors = {
    danger: "bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500",
    warning: "bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500",
    primary: "bg-orange-600 hover:bg-orange-700 text-white focus:ring-orange-500",
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-stone-800">
          <AlertTriangle
            className={`w-5 h-5 ${
              variant === "danger"
                ? "text-rose-600"
                : variant === "warning"
                ? "text-amber-600"
                : "text-orange-600"
            }`}
          />
          <span>{title}</span>
        </div>
      }
      maxWidth="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-stone-600 leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-3 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-5 py-2 text-sm font-bold rounded-xl shadow transition ${buttonColors[variant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};

