import React from 'react';
import { AlertTriangle, Info, CheckCircle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary' | 'success';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  isLoading = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <AlertTriangle className="h-6 w-6 text-red-600" />,
          btn: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white'
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="h-6 w-6 text-amber-600" />,
          btn: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white'
        };
      case 'success':
        return {
          icon: <CheckCircle className="h-6 w-6 text-emerald-600" />,
          btn: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 text-white'
        };
      default:
        return {
          icon: <Info className="h-6 w-6 text-emerald-600" />,
          btn: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 text-white'
        };
    }
  };

  const { icon, btn } = getVariantStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 rounded-xl bg-zinc-50 p-2.5 border border-zinc-100">
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
            <div className="mt-2 text-sm text-zinc-600">{message}</div>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 focus:outline-hidden disabled:opacity-50 cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium shadow-xs focus:outline-hidden focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 flex items-center space-x-2 cursor-pointer ${btn}`}
          >
            {isLoading && (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
