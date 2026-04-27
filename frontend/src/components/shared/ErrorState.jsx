import { AlertCircle, RotateCw } from "lucide-react";

export default function ErrorState({ message = "Terjadi kesalahan", onRetry }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6">
      <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold mb-1">Oops!</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full pill-active text-sm font-medium"
        >
          <RotateCw className="h-4 w-4" /> Coba lagi
        </button>
      )}
    </div>
  );
}
