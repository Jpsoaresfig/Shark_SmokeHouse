"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CloudinaryUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
}

export async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", uploadPreset);
  body.append("folder", "shark-smokehouse");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body }
  );

  if (!res.ok) throw new Error("Falha ao enviar imagem.");
  const data = await res.json();
  return data.secure_url as string;
}

export function CloudinaryUpload({
  value,
  onChange,
  maxImages = 5,
}: CloudinaryUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number[]>([]);
  const [error, setError] = useState("");
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  const canAdd = value.length < maxImages;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");

    const remaining = maxImages - value.length;
    const toUpload  = Array.from(files).slice(0, remaining);

    if (toUpload.length === 0) return;

    setUploading(true);
    setProgress(Array(toUpload.length).fill(0));

    const results: string[] = [];
    for (let i = 0; i < toUpload.length; i++) {
      try {
        const url = await uploadToCloudinary(toUpload[i]);
        results.push(url);
        setProgress(p => p.map((v, j) => (j <= i ? 100 : v)));
      } catch {
        setError("Erro ao enviar uma ou mais imagens. Tente novamente.");
      }
    }

    onChange([...value, ...results]);
    setUploading(false);
    setProgress([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  /* ── Drag-to-reorder ── */
  const onDragStart = (idx: number) => { dragItem.current = idx; };
  const onDragEnter = (idx: number) => { dragOver.current = idx; };
  const onDragEnd   = () => {
    if (dragItem.current === null || dragOver.current === null) return;
    const next = [...value];
    const [moved] = next.splice(dragItem.current, 1);
    next.splice(dragOver.current, 0, moved);
    onChange(next);
    dragItem.current = null;
    dragOver.current = null;
  };

  /* ── Drop zone ── */
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium text-[var(--color-text-secondary)]">
        Imagens do Produto
        <span className="ml-2 text-xs text-[var(--color-text-muted)]">
          {value.length}/{maxImages} · arraste para reordenar
        </span>
      </label>

      {/* Previews */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {value.map((url, i) => (
            <div
              key={url + i}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragEnter={() => onDragEnter(i)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className="group relative aspect-square rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-overlay)] cursor-grab active:cursor-grabbing"
            >
              <Image src={url} alt={`imagem ${i + 1}`} fill className="object-cover" sizes="120px" />

              {i === 0 && (
                <span className="absolute top-1 left-1 text-[10px] font-bold bg-[var(--color-neon-blue)] text-[var(--color-bg-base)] px-1.5 py-0.5 rounded-full leading-none pointer-events-none">
                  Principal
                </span>
              )}

              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />

              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Upload-more tile — inside the grid */}
          {canAdd && !uploading && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue-glow)] text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] transition-all flex flex-col items-center justify-center gap-1"
            >
              <Upload className="w-5 h-5" />
              <span className="text-[10px] font-medium">Adicionar</span>
            </button>
          )}
        </div>
      )}

      {/* Upload zone — shown when no images yet */}
      {value.length === 0 && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !uploading && inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all py-10 px-4 text-center",
            uploading
              ? "border-[var(--color-neon-blue)]/40 bg-[var(--color-neon-blue-glow)] cursor-not-allowed"
              : "border-[var(--color-border)] hover:border-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue-glow)] cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)]"
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="w-8 h-8 text-[var(--color-neon-blue)] animate-spin" />
              <p className="text-sm font-medium text-[var(--color-neon-blue)]">Enviando imagens…</p>
              <div className="flex gap-1.5 mt-1">
                {progress.map((_, i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-[var(--color-neon-blue)] animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </>
          ) : (
            <>
              <ImageIcon className="w-10 h-10" />
              <div>
                <p className="text-sm font-semibold">Clique ou arraste as imagens aqui</p>
                <p className="text-xs mt-0.5 opacity-70">JPG, PNG, WEBP · máx 5 MB por foto</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Upload progress bar — when already has images */}
      {uploading && value.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--color-neon-blue)]/30 bg-[var(--color-neon-blue-glow)]">
          <Loader2 className="w-4 h-4 text-[var(--color-neon-blue)] animate-spin shrink-0" />
          <p className="text-sm text-[var(--color-neon-blue)]">Enviando {progress.length} imagem{progress.length !== 1 ? "s" : ""}…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-[var(--color-error)] px-1">{error}</p>
      )}

      {/* Hidden input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
