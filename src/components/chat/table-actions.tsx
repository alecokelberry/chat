// A reply's table, Streamdown's `table` override (reply.tsx): the same
// outlined card, with a toolbar over its top corner on hover (always on
// touch, and while it holds focus). Copy puts the rows on the clipboard
// tab-separated, so they paste into a spreadsheet as rows and columns;
// Save as CSV downloads them. Both read the table's cells at the press, so
// a table still streaming copies what shows.
import { useRef, type ComponentProps } from "react"
import { DownloadIcon } from "lucide-react"
import {
  extractTableDataFromElement,
  tableDataToCSV,
  tableDataToTSV,
} from "streamdown"

import { CopyAction, MessageAction } from "@/components/chat/message-action"
import { MessageToolbar } from "@/components/ui/message-toolbar"

export function Table({
  node: _node,
  ...props
}: ComponentProps<"table"> & {
  node?: unknown
}) {
  const table = useRef<HTMLTableElement>(null)
  const data = () =>
    table.current
      ? extractTableDataFromElement(table.current)
      : { headers: [], rows: [] }
  const save = () => {
    const url = URL.createObjectURL(
      new Blob([tableDataToCSV(data())], { type: "text/csv;charset=utf-8" })
    )
    const link = document.createElement("a")
    link.href = url
    link.download = "table.csv"
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div data-streamdown="table-wrapper" className="group/table relative">
      <div data-slot="table-scroll" className="scroll-fade-x">
        <table ref={table} data-streamdown="table" {...props} />
      </div>
      <div className="absolute end-2 top-2 rounded-full bg-popover opacity-0 shadow-tooltip transition-opacity duration-fast ease-standard group-hover/table:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
        <MessageToolbar aria-label="Table actions">
          <CopyAction
            text={() => tableDataToTSV(data())}
            label="Copy table"
            size="header"
          />
          <MessageAction label="Save as CSV" size="header" onClick={save}>
            <DownloadIcon aria-hidden />
          </MessageAction>
        </MessageToolbar>
      </div>
    </div>
  )
}
