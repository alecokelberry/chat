// The composer's attachments (src/lib/chat/attachments.ts has the rules),
// and a question's images and documents in the thread. The + at the
// composer's start opens the system picker at once; on an iPhone that
// offers the photo library, the camera and Files. Pasting into the message or
// dropping anywhere on the page (an overlay says "Drop to attach") adds
// files too. Each file shows as a tile above the text, a spinner until
// it's ready (an image's thumbnail, or a document's name and kind), with ✕
// to take it out; a file the rules turn away, or one that won't decode,
// never joins, and a toast says why. A PDF with no text (a scan) stays,
// its chip saying "No text found", and Send waits until it's out. Editing
// a question starts from what it was sent with, under the same rules. A
// question shows its images as a row of thumbnails above its bubble, a
// tap opening one full size, and its documents as chips.
// With images attached and a model that can't see them (Ultra, Lightning),
// Send waits and a line under the composer offers "Switch to Super".
import { useRef, useState } from "react"
import type { FileUIPart } from "ai"
import { ImageOffIcon, PlusIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FileChip } from "@/components/ui/file-chip"
import {
  createFileInputController,
  FileInput,
  FileInputDropOverlay,
  FileInputItem,
  FileInputItemRemove,
  FileInputList,
} from "@/components/ui/file-input"
import { ImageViewer } from "@/components/ui/image-viewer"
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
  NoTextError,
  attachmentPart,
  isImageFile,
  type AttachmentPart,
  MAX_FILE_BYTES,
  MAX_FILES,
} from "@/lib/chat/attachments"
import type { DocumentData } from "@/lib/chat/documents"

type FileRejection = Parameters<
  NonNullable<React.ComponentProps<typeof FileInput>["onReject"]>
>[0][number]

type RejectReason = FileRejection["reasons"][number]

const REASONS: Partial<Record<RejectReason, string>> = {
  "file-type": "Only images, PDFs and text files can be attached",
  "file-too-large": `Files can be up to ${MAX_FILE_BYTES / 1_000_000} MB`,
  "too-many-files": `Up to ${MAX_FILES} files a message`,
}

/** Why a file was turned away, in words. */
function reasonFor({ file, reasons: [reason] }: FileRejection) {
  const words =
    (reason === undefined ? undefined : REASONS[reason]) ?? "Can't attach it"
  return reason === "too-many-files" ? words : `${file.name}: ${words}`
}

/** A sent attachment as a file the file input can hold: empty, named
 *  and typed like it, and already ready as `part`. */
const standIn = (part: AttachmentPart) =>
  part.type === "file"
    ? new File([], part.filename ?? "image.jpg", { type: part.mediaType })
    : new File([], part.data.name, { type: part.data.mediaType })

/** The composer's files, or an edited question's (starting from what it
 *  was sent with, `initial`): what's attached, which are ready to send,
 *  and the file input's controller and handlers. */
export function useAttachments(initial: readonly AttachmentPart[] = []) {
  const [seed] = useState(() =>
    initial.map((part) => [standIn(part), part] as const)
  )
  const [files, setFiles] = useState(() => seed.map(([file]) => file))
  const [ready, setReady] = useState(() => new Map<File, AttachmentPart>(seed))
  // Documents with no text: still attached, holding Send.
  const [empty, setEmpty] = useState(() => new Set<File>())
  const [controller] = useState(createFileInputController)

  // The files attached right now, for a preparation that ends after its
  // file was taken out: it's dropped, without a toast.
  const attached = useRef(files)

  /** Keeps `ready` to the files still attached. */
  function keep(value: File[]) {
    attached.current = value
    setFiles(value)
    setReady(
      (parts) => new Map([...parts].filter(([file]) => value.includes(file)))
    )
    setEmpty(
      (files) => new Set([...files].filter((file) => value.includes(file)))
    )
  }

  function prepare(file: File) {
    attachmentPart(file).then(
      (part) => {
        if (attached.current.includes(file))
          setReady((parts) => new Map(parts).set(file, part))
      },
      (error: unknown) => {
        if (!attached.current.includes(file)) return
        if (error instanceof NoTextError) {
          setEmpty((files) => new Set(files).add(file))
          return
        }
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
    /** Send waits: a file is still being prepared, or has no text. */
    waiting: parts.length < files.length,
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
    /** Whether any file is an image, ready or not. */
    hasImages: files.some(isImageFile),
    /** The ready part for a file, for its tile. */
    partFor: (file: File) => ready.get(file),
    /** Whether a file turned out to have no text. */
    hasNoText: (file: File) => empty.has(file),
  }
}

export type Attachments = ReturnType<typeof useAttachments>

/** The file input around the composer: picker, paste into `pasteInto`,
 *  and drops anywhere on the page. An edited question's (no `pasteInto`)
 *  takes the picker only, so a drop still goes to the composer. */
export function AttachmentsInput({
  attachments,
  pasteInto,
  label = "Attachments",
  children,
}: {
  attachments: Attachments
  pasteInto?: () => HTMLElement | null
  label?: string
  children: React.ReactNode
}) {
  return (
    <FileInput
      // A labelled group: aria-label alone isn't allowed on a plain div.
      role="group"
      aria-label={label}
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
      {pasteInto && (
        <FileInputDropOverlay pasteTarget={pasteInto}>
          Drop to attach
        </FileInputDropOverlay>
      )}
    </FileInput>
  )
}

/** The + at the composer's start: it opens the system picker at once. */
export function AttachButton({
  controller,
}: {
  controller: Attachments["controller"]
}) {
  return (
    <Tooltip type="label">
      <TooltipTrigger
        render={
          <Button
            size="circle"
            aria-label="Attach"
            onClick={() => controller.open()}
          />
        }
      >
        <PlusIcon className="size-icon" />
      </TooltipTrigger>
      <TooltipContent>Attach</TooltipContent>
    </Tooltip>
  )
}

/** The attached files as tiles above the text, each with ✕: at the
 *  start in the composer, at the end in an edited question. */
export function AttachmentTiles({
  attachments,
  align,
}: {
  attachments: Attachments
  align?: "start" | "end"
}) {
  if (attachments.files.length === 0) return null
  return (
    <FileInputList aria-label="Attached files" className="w-full" align={align}>
      <FileInputItem>
        {({ file }) => {
          const part = attachments.partFor(file)
          return (
            <>
              {attachments.hasNoText(file) ? (
                <FileChip name={file.name} kind="No text found" />
              ) : part === undefined ? (
                <Spinner />
              ) : part.type === "file" ? (
                <img src={part.url} alt={file.name} />
              ) : (
                <FileChip name={file.name} kind={kindOf(part.data)} />
              )}
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

/** A question's attachments above its bubble: its images as thumbnails,
 *  each opening full size, then its documents as chips. */
export function QuestionAttachments({
  images,
  documents,
}: {
  images: FileUIPart[]
  documents: DocumentData[]
}) {
  const [open, setOpen] = useState<FileUIPart | null>(null)
  if (images.length === 0 && documents.length === 0) return null
  return (
    <>
      <ul
        aria-label="Attached files"
        className="flex flex-wrap items-end justify-end gap-2"
      >
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
        {documents.map((document, index) => (
          <li key={`${index}-${document.name}`}>
            <FileChip name={document.name} kind={kindOf(document)} />
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

/** Under the composer when its images would go to a model that can't see
 *  them (`blind`): Send waits, and one tap switches to `to`, a model that
 *  can. The model never changes on its own. The status region is always
 *  on the page and empty until then, since screen readers often skip a
 *  live region that arrives already filled; the line people see is
 *  hidden from them, so it isn't read twice. */
export function CantSeeImages({
  blind,
  model,
  to,
  onSwitch,
}: {
  blind: boolean
  model: string
  to: string
  onSwitch: () => void
}) {
  const line = `${model} can't see images`
  return (
    <>
      <p role="status" className="sr-only">
        {blind ? line : ""}
      </p>
      {blind && (
        <p className="flex items-center justify-center gap-2 pt-2 text-sm text-muted-foreground">
          <span aria-hidden>{line}</span>
          <Button variant="outline" size="sm" onClick={onSwitch}>
            {`Switch to ${to}`}
          </Button>
        </p>
      )}
    </>
  )
}

/** A document's kind, under its name. */
const kindOf = (document: Pick<DocumentData, "mediaType">) =>
  document.mediaType === "application/pdf" ? "PDF" : "Text"
