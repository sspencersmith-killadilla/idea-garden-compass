import { FileText, Trash2, Download } from "lucide-react";
import { isImage, prettySize, type IdeaFile } from "@/lib/files";

export function FileGallery({ files, onDelete }: { files: IdeaFile[]; onDelete?: ((f: IdeaFile) => void) | undefined }) {
  if (!files.length) return null;
  const imgs = files.filter((f) => isImage(f.mime));
  const docs = files.filter((f) => !isImage(f.mime));
  return (
    <div className="space-y-3">
      {imgs.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {imgs.map((f) => (
            <div key={f.path} className="group relative overflow-hidden rounded-lg border bg-muted">
              <a href={f.url ?? "#"} target="_blank" rel="noreferrer"><img src={f.url ?? ""} alt={f.name} loading="lazy" className="aspect-square w-full object-cover" /></a>
              {onDelete && <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onDelete(f)} className="absolute right-1 top-1 rounded-md bg-card/90 p-1 text-destructive opacity-0 transition group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
          ))}
        </div>
      )}
      {docs.map((f) => (
        <div key={f.path} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-brand-teal" />
          <a href={f.url ?? "#"} target="_blank" rel="noreferrer" download={f.name} className="min-w-0 flex-1 truncate font-medium text-primary hover:text-brand-teal">{f.name}</a>
          <span className="text-xs text-muted-foreground">{prettySize(f.size)}</span>
          <a href={f.url ?? "#"} download={f.name} aria-label={`Download ${f.name}`} className="text-muted-foreground hover:text-primary"><Download className="h-4 w-4" /></a>
          {onDelete && <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onDelete(f)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
        </div>
      ))}
    </div>
  );
}
