// The model picker: which model answers the next message (src/lib/ai/
// models.ts), as a Select in the composer, a popover, and a sheet from the
// bottom on phones. The button shows the model's short name ("Super"); the
// list shows the full names, A to Z, with a check on the chosen one.
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MODELS, type ModelKey } from "@/lib/ai/models"

const sorted = MODELS.toSorted((a, b) => a.fullName.localeCompare(b.fullName))
// On the root too, so the button shows the name before the list has ever
// opened, server rendering included.
const items = MODELS.map((model) => ({ value: model.key, label: model.name }))

export function ModelPicker({
  value,
  onValueChange,
}: {
  value: ModelKey
  onValueChange: (model: ModelKey) => void
}) {
  return (
    <Select<ModelKey>
      items={items}
      value={value}
      onValueChange={(model) => {
        if (model !== null) onValueChange(model)
      }}
    >
      <SelectTrigger aria-label="Model">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {sorted.map((model) => (
          <SelectItem key={model.key} value={model.key} label={model.name}>
            {model.fullName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
