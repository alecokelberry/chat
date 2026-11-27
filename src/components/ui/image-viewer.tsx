// Image viewer: one image full size in a Dialog (a sheet on a phone),
// its name as the title above it. The image fits the panel whatever its
// shape, never cropped: a tall screenshot is at most three fifths of the
// screen high. Opened by a question's thumbnail
// (chat/attachments.tsx); Escape, a press outside or a swipe down closes it.
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

function ImageViewer({
  image,
  onClose,
}: {
  image: { url: string; name: string } | null
  onClose: () => void
}) {
  return (
    <Dialog
      open={image !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent fit>
        <DialogTitle className="shrink-0 truncate px-5 pt-4 pb-3 text-base font-medium">
          {image?.name}
        </DialogTitle>
        {image && (
          <img
            src={image.url}
            alt={image.name}
            className="max-h-image-viewer min-h-0 w-full object-contain pb-safe"
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

export { ImageViewer }
