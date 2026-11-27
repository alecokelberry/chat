// The composer's attachments (src/lib/chat/attachments.ts has the rules),
// and a question's images in the thread. The + at the composer's start
// opens a menu (a sheet on a phone) whose one row, "Add photos & files",
// opens the system picker; on an iPhone that offers the photo library,
// the camera and Files. Pasting into the message or dropping anywhere on
// the page (an overlay says "Drop to attach") adds files too. Each file
// shows as a tile above the text, a spinner until its image is ready,
// with ✕ to take it out; a file the rules turn away, or one that won't
// decode, never joins, and a toast says why. A question shows its images
// as a row of thumbnails above its bubble, and a tap opens one full size.
import { useRef, useState } from "react"
import type { FileUIPart } from "ai"
import { ImageOffIcon, ImagePlusIcon, PlusIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  createFileInputController,
  FileInput,
  FileInputDropOverlay,
  FileInputItem,
  FileInputItemRemove,
  FileInputList,
} from "@/components/ui/file-input"
import { ImageViewer } from "@/components/ui/image-viewer"
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ACCEPT,
  AttachmentError,
  imagePart,
  MAX_FILE_BYTES,
  MAX_FILES,
} from "@/lib/chat/attachments"

type FileRejection = Parameters<
  NonNullable<React.ComponentProps<typeof FileInput>["onReject"]>
>[0][number]

type RejectReason = FileRejection["reasons"][number]

const REASONS: Partial<Record<RejectReason, string>> = {
  "file-type": "Only images can be attached",
  "file-too-large": `Files can be up to ${MAX_FILE_BYTES / 1_000_000} MB`,
  "too-many-files": `Up to ${MAX_FILES} files a message`,
}

/** Why a file was turned away, in words. */
function reasonFor({ file, reasons: [reason] }: FileRejection) {
  const words =
    (reason === undefined ? undefined : REASONS[reason]) ?? "Can't attach it"
  return reason === "too-many-files" ? words : `${file.name}: ${words}`
}

/** The composer's files: what's attached, which are ready to send, and
 *  the file input's controller and handlers. */
export function useAttachments() {
  const [files, setFiles] = useState<File[]>([])
  const [ready, setReady] = useState(() => new Map<File, FileUIPart>())
  const [controller] = useState(createFileInputController)

  // The files attached right now, for a preparation that ends after its
  // file was taken out: it's dropped, without a toast.
  const attached = useRef<File[]>([])

  /** Keeps `ready` to the files still attached. */
  function keep(value: File[]) {
    attached.current = value
    setFiles(value)
    setReady(
      (parts) => new Map([...parts].filter(([file]) => value.includes(file)))
    )
  }

  function prepare(file: File) {
    imagePart(file).then(
      (part) => {
        if (attached.current.includes(file))
          setReady((parts) => new Map(parts).set(file, part))
      },
      (error: unknown) => {
        if (!attached.current.includes(file)) return
        keep(attached.current.filter((other) => other !== file))
        toast.error(
          error instanceof AttachmentError ? error.message : "Can't attach it"
        )
      }
    )
  }

  const parts = files.flatMap((file) => ready.get(file) ?? [])
  return {
    controller,
    files,
    parts,
    preparing: parts.length < files.length,
    clear: () => keep([]),
    onValueChange: (value: File[], details: { added: readonly File[] }) => {
      keep(value)
      details.added.forEach(prepare)
    },
    onReject: (rejected: readonly FileRejection[]) => {
      // One toast for a batch over the limit, not one per file.
      const reasons = new Set(rejected.map(reasonFor))
      reasons.forEach((reason) => toast.error(reason))
    },
    /** The ready image for a file, for its tile. */
    partFor: (file: File) => ready.get(file),
  }
}

export type Attachments = ReturnType<typeof useAttachments>

/** The file input around the composer: picker, paste into `pasteInto`,
 *  and drops anywhere on the page. */
export function AttachmentsInput({
  attachments,
  pasteInto,
  children,
}: {
  attachments: Attachments
  pasteInto: () => HTMLElement | null
  children: React.ReactNode
}) {
  return (
    <FileInput
      aria-label="Attachments"
      multiple
      accept={ACCEPT}
      maxFiles={MAX_FILES}
      maxSize={MAX_FILE_BYTES}
      value={attachments.files}
      onValueChange={attachments.onValueChange}
      onReject={attachments.onReject}
      controller={attachments.controller}
    >
      {children}
      <FileInputDropOverlay pasteTarget={pasteInto}>
        Drop to attach
      </FileInputDropOverlay>
    </FileInput>
  )
}

/** The + at the composer's start, and its menu. */
export function AttachMenu({
  controller,
}: {
  controller: Attachments["controller"]
}) {
  return (
    <Menu>
      <Tooltip type="label">
        <TooltipTrigger
          render={
            <MenuTrigger
              render={<Button size="circle" aria-label="Attach" />}
            />
          }
        >
          <PlusIcon className="size-icon" />
        </TooltipTrigger>
        <TooltipContent>Attach</TooltipContent>
      </Tooltip>
      <MenuContent>
        <MenuItem onClick={() => controller.open()}>
          <ImagePlusIcon aria-hidden />
          Add photos & files
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

/** The attached files as tiles above the text, each with ✕. */
export function AttachmentTiles({ attachments }: { attachments: Attachments }) {
  if (attachments.files.length === 0) return null
  return (
    <FileInputList aria-label="Attached files" className="w-full">
      <FileInputItem>
        {({ file }) => {
          const part = attachments.partFor(file)
          return (
            <>
              {part ? <img src={part.url} alt={file.name} /> : <Spinner />}
              <FileInputItemRemove>
                <XIcon aria-hidden />
              </FileInputItemRemove>
            </>
          )
        }}
      </FileInputItem>
    </FileInputList>
  )
}

/** A question's images: thumbnails above its bubble, each opening full
 *  size. */
export function QuestionImages({ images }: { images: FileUIPart[] }) {
  const [open, setOpen] = useState<FileUIPart | null>(null)
  if (images.length === 0) return null
  return (
    <>
      <ul aria-label="Images" className="flex flex-wrap justify-end gap-2">
        {images.map((image, index) => (
          <li key={`${index}-${image.filename}`}>
            <Button
              variant="outline"
              size="thumbnail"
              aria-label={`View ${image.filename ?? "image"}`}
              onClick={() => setOpen(image)}
            >
              <Thumbnail url={image.url} />
            </Button>
          </li>
        ))}
      </ul>
      <ImageViewer
        image={open && { url: open.url, name: open.filename ?? "Image" }}
        onClose={() => setOpen(null)}
      />
    </>
  )
}

/** A thumbnail's image, or a crossed-out picture if it won't decode. */
function Thumbnail({ url }: { url: string }) {
  const [broken, setBroken] = useState(false)
  return broken ? (
    <ImageOffIcon aria-hidden />
  ) : (
    <img src={url} alt="" onError={() => setBroken(true)} />
  )
}
