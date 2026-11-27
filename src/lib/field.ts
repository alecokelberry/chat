// Reads one field of a value saved or sent as data (a message's metadata
// or parts, which come from the browser or storage), unchecked: each
// caller checks the type it needs.

/** `value[key]` if value is an object that has it, else undefined. */
export const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null && key in value
    ? Reflect.get(value, key)
    : undefined
