import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@cantiara/ui/components/alert-dialog";
import { Button } from "@cantiara/ui/components/button";
import { useCallback } from "react";

export default function RevokeConfirmation({
  description,
  disabled,
  label,
  onConfirm,
  targetSessionAlias,
  title,
}: {
  description: string;
  disabled: boolean;
  label: "Revoke Other Sessions" | "Revoke Session";
  onConfirm: (targetSessionAlias: string) => void;
  targetSessionAlias: string;
  title: string;
}) {
  const handleConfirm = useCallback(() => {
    onConfirm(targetSessionAlias);
  }, [onConfirm, targetSessionAlias]);

  return (
    <AlertDialog>
      <AlertDialogTrigger
        disabled={disabled}
        render={<Button size="sm" variant="destructive" />}
      >
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogCancel onClick={handleConfirm} variant="destructive">
            {label}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
