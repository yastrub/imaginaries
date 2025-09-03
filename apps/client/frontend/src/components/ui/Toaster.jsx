import * as React from "react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"

// Memoize individual toast to prevent re-renders
const MemoizedToast = React.memo(function MemoizedToast({ id, title, description, action, ...props }) {
  return (
    <Toast key={id} {...props}>
      <div className="grid gap-1">
        {title && <ToastTitle>{title}</ToastTitle>}
        {description && (
          <ToastDescription>{description}</ToastDescription>
        )}
      </div>
      {action}
      <ToastClose />
    </Toast>
  );
});

// Use React.memo to prevent unnecessary re-renders of the entire Toaster
export const Toaster = React.memo(function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(props => <MemoizedToast key={props.id} {...props} />)}
      <ToastViewport />
    </ToastProvider>
  );
});