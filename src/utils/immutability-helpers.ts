/**
 * Adds an item to a list, if it does not exist, yet.
 * @param list The array that might contain the given item.
 * @param item The element that should be added.
 */
export function add<I>(list: I[], item: I): I[] {
  if (!list.includes(item)) {
    return [...list, item]
  }

  return list
}

/**
 * Removes an item from a list, if it exists.
 * @param list The array that might contain the given item.
 * @param item The element that should be removed.
 */
export function remove<I>(list: I[], item: I): I[] {
  if (list.includes(item)) {
    return list.filter((currentItem) => currentItem !== item)
  }

  return list
}

/**
 * Adds an item to a list, if it does not exist, yet.
 * If it does exist, however, it removes it.
 * @param list The array that might contain the given item.
 * @param item The element that should be added or removed.
 */
export function toggle<I>(list: I[], item: I): I[] {
  if (!list.includes(item)) {
    return add(list, item)
  }

  return remove(list, item)
}

/**
 * Like Array map() but for objects.
 * Example: { foo: "bar" } => { foo1: "bar1" }
 * @param obj Object to iterate.
 * @param cb Callback that transforms key and value.
 */
export function objectMap(
  obj: Record<string, unknown> | undefined,
  cb: (key: string, value: unknown) => Record<string, unknown>,
): Record<string, unknown> {
  let newObj: Record<string, unknown> = {}

  for (const key in obj) {
    newObj = { ...newObj, ...cb(key, obj[key]) }
  }

  return newObj
}
