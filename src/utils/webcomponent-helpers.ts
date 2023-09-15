import anime, { AnimeInstance, AnimeParams } from "animejs"
import * as redux from "redux"
// @ts-ignore
import componentGraph from "./webcomponent-graph.json"

type IndexableElement = Record<string, any> & Element

export type SDXWebComponent<S> = {
  el: IndexableElement
  state?: StateHandle<S>
}

export type StateHandle<T> = {
  get(): T
}

// Under this key the store will be created (on a DOM node)
const storeKey = "__store"

// Under this key the name of the parent will be saved (e.g. sdx-select)
const parentKey = "__parent"

const NOOP = () => {
  // Do nothing
}

export const animation = {
  set: anime.set,
  start(params: AnimeParams): AnimeInstance {
    const { duration, complete, targets } = params

    // Ensure to abort potentially already-running animations to prevent race
    // condition side effects, like callbacks that were executed too late, see:
    // https://git.swisscom.com/projects/SDX/repos/sdx/pull-requests/923/overview?commentId=1094510
    anime.remove(targets!)

    const overrides: AnimeParams = {
      easing: "cubicBezier(0.550, 0.085, 0.320, 1)",
    }

    // If the duration is 0 (which means it's not animated), make sure the cb
    // is executed immediately instead of next tick (which is Anime's default)
    // which sometimes leads to laggy or incomplete animations.
    if (duration === 0) {
      delete params.complete
    }

    const instance = anime({ ...params, ...overrides })

    if (duration === 0) {
      complete?.(instance)
    }

    return instance
  },
  scaleIn(el: HTMLElement, duration: number = 200) {
    animation.set(el, { scale: 0, display: "inline-block" })

    const instance = animation.start({
      targets: el,
      duration,
      scale: 1,
    })

    return instance.finished
  },
  scaleOut(el: HTMLElement, duration: number = 200) {
    animation.set(el, { scale: 1, display: "inline-block" })

    const instance = animation.start({
      targets: el,
      duration,
      scale: 0,
      complete: () => {
        animation.set(el, { display: "none" })
      },
    })

    return instance.finished
  },
  fadeIn(el: HTMLElement, duration: number = 200) {
    animation.set(el, { opacity: 0, display: "inline-block" })

    const instance = animation.start({
      targets: el,
      duration,
      opacity: 1,
    })

    return instance.finished
  },
  fadeOut(el: HTMLElement, duration: number = 200) {
    animation.set(el, { opacity: 1, display: "inline-block" })

    const instance = animation.start({
      targets: el,
      duration,
      opacity: 0,
      complete: () => {
        animation.set(el, { display: "none" })
      },
    })

    return instance.finished
  },
}

/**
 * Provides a proxy object for a component to a store.
 * During construction, it installs a store on a given component (specifically
 * on its DOM node).
 * If the component is a child (e.g. "sdx-select-option"), it returns the
 * store of its parent (e.g. "sdx-select").
 * If no store is found, it creates a new one and installs it on the parent.
 * @param cmp Component that requests the store.
 * @param reducer Reducer function.
 * @param initialState Default state of this store.
 * @param properties List of properties that will be updated (if changed).
 */
export class StoreConnection<
  C extends SDXWebComponent<S>,
  S,
  A extends redux.AnyAction,
> {
  private properties: (keyof S)[]
  private store: Store<S, A>
  private history: S[] = []

  constructor(
    private cmp: C,
    private reducer: redux.Reducer<S, A>,
    initialState: S,
    properties: (keyof S)[] = [],
  ) {
    this.properties = properties

    const parentTagName = getParentTagName(cmp.el.tagName.toLowerCase())

    // Looking for existing store
    let currentEl = cmp.el

    this.store = currentEl[storeKey]

    if (parentTagName) {
      currentEl = closest(
        parent(currentEl)!,
        (el: IndexableElement) =>
          // Check if the parent was found (tagName match) or if a store exists
          el.matches(parentTagName) || el[parentKey] === parentTagName,
      ) as IndexableElement

      this.store = currentEl[storeKey]
    }

    // Store does not exist, create one
    if (!this.store) {
      this.store = new Store<S, A>(reducer, initialState)
      currentEl[storeKey] = this.store
    }

    // Keep a reference to the store so that the children of this child don't
    // have to traverse up that far.
    // This enables that components can be created while the parent is
    // currently appended to document.body and their parent (the holder of the
    // store) can't be found.
    cmp.el[storeKey] = this.store
    cmp.el[parentKey] = currentEl.tagName.toLowerCase()

    if (!parentTagName) {
      // this is a parent (e.g. sdx-select)
      this.store.connected = true
    }

    const { reduxStore } = this.store
    const state = reduxStore.getState()

    cmp.state = {
      get: reduxStore.getState,
    }

    this.history.push(state)
  }

  // Allows an individual property to be set on the store without having to
  // call dispatch()
  public set<P extends keyof S>(property: P, value: S[P]): void {
    // Automatically dispatches the action
    this.store.reduxStore.replaceReducer(
      (state) => ({ ...state, [property]: value }) as S,
    )

    // Restore
    this.store.reduxStore.replaceReducer(this.reducer)
  }

  public dispatch(action: A): void {
    this.store.dispatch(action)
  }

  public flush(): void {
    this.store.flush()
  }

  public subscribe(): void {
    this.sync()
    this.store.reduxStore.subscribe(() => this.sync())
  }

  // "Pulls" the current state into the component (triggering its watchers)
  private sync() {
    const { getState } = this.store.reduxStore
    const state = getState()
    const prevState = this.history[this.history.length - 1]

    // When dispatch() calls another dispatch()…
    this.history.push(state)

    // If any of the listed properties has changed, set the store again
    // in order to trigger the component lifecycle including watchers
    for (const property of this.properties) {
      if (prevState[property] !== state[property]) {
        // Before writing the new state, point the function reference to the
        // prevState to ensure it can be accessed (needed by the watchers to
        // find out which property exactly has changed).
        this.cmp.state!.get = () => {
          return this.history[this.history.length - 2]
        }

        // Write the store (triggers component lifecycle)
        this.cmp.state = {
          get: getState,
        }

        // Writing the store once is enough
        break
      }
    }

    // Clear history
    this.history.shift()
  }
}

class Store<S, A extends redux.AnyAction> {
  public reduxStore: redux.Store<S, A>
  public connected = false

  private queue: A[] = []

  constructor(reducer: redux.Reducer<S, A>, initialState: any) {
    this.reduxStore = redux.createStore(reducer, initialState)
  }

  public dispatch(action: A): void {
    if (this.connected) {
      this.reduxStore.dispatch(action)
    } else {
      this.queue.push(action)
    }
  }

  public flush(): void {
    this.queue.forEach((action) => {
      this.reduxStore.dispatch(action)
    })

    this.queue = []
  }
}

function getParentTagName(tagName: string): string | undefined {
  const group = componentGraph.find((groups) => groups.includes(tagName))

  if (group) {
    if (group[0] !== tagName) {
      return group[0]
    } else {
      // It *is* the parent
      return
    }
  } else {
    // Warn if not found…

    // eslint-disable-next-line no-console
    console.warn(`Element with tagName ${tagName} not found in componentGraph`)

    return tagName
  }
}

/**
 * Evaluates a function string and returns the result.
 * Do nothing if the passed parameter already is a function.
 * @param fn Function - either as a string or as a function itself
 */
export function parseFunction(fn?: string | Function): Function {
  if (typeof fn === "string") {
    return new Function(fn)
  } else if (typeof fn === "function") {
    return fn
  } else {
    return NOOP
  }
}

/**
 * Returns the parent element of a given element.
 * Also checks shadow roots and slots.
 * @param el Element to read its parent from.
 */
export function parent(el: Element): Element | undefined {
  if (el.assignedSlot) {
    return el.assignedSlot
  }

  if (el.parentElement) {
    return el.parentElement
  }

  const rootNode = el.getRootNode() as ShadowRoot

  if (rootNode.host) {
    return rootNode.host
  }

  return undefined
}

/**
 * Traverses up from a given element and compares each parent until first match.
 * @param el Element to start from.
 * @param selector A selector (can be a string, an element or a function).
 */
export function closest(
  el: Element | null,
  selector: string | Element | ((el: Element) => boolean),
): Element | undefined {
  let currentEl: Element | undefined | null = el

  while (currentEl) {
    if (
      (typeof selector === "string" && currentEl.matches(selector)) ||
      (typeof selector === "object" && currentEl === selector) ||
      (typeof selector === "function" && selector(currentEl))
    ) {
      return currentEl
    }

    currentEl = parent(currentEl)
  }

  return undefined
}

/**
 * Returns the previous element of a list.
 * Restart from the end if the given element is the first on the list.
 * @param list Array to pick element from.
 * @param el Item that will be used to get the index.
 * @param loop Restart if end has reached.
 */
export function getPreviousFromList<T>(list: T[], el: T, restart = true): T {
  let index
  let newIndex = 0

  if (el) {
    index = list.indexOf(el)
  }

  if (index !== undefined) {
    if (index - 1 >= 0) {
      // previous exists
      newIndex = index - 1
    } else if (restart) {
      // already at the beginning, jump to the end
      newIndex = list.length - 1
    } else {
      newIndex = index
    }
  }

  return list[newIndex]
}

/**
 * Returns the next element of a list.
 * Restart from the beginning if the given element is the last on the list.
 * @param list Array to pick element from.
 * @param el Item that will be used to get the index.
 * @param loop Restart if end has reached.
 */
export function getNextFromList<T>(list: T[], el: T, restart = true): T {
  let index
  let newIndex = 0

  if (el) {
    index = list.indexOf(el)
  }

  if (index !== undefined) {
    if (index + 1 < list.length) {
      // next exists
      newIndex = index + 1
    } else if (restart) {
      newIndex = 0
    } else {
      // already at the end, jump to the beginning
      newIndex = index
    }
  }

  return list[newIndex]
}

/**
 * Sorts a list of DOM nodes by their appearance in the DOM tree.
 */
export function sortByAppearanceInDomTree(a: Element, b: Element) {
  const position = a.compareDocumentPosition(b)

  return position <= Node.DOCUMENT_POSITION_PRECEDING
    ? position <= Node.DOCUMENT_POSITION_FOLLOWING
      ? 1
      : 0
    : -1
}

/**
 * Builds an object with one property using a given name and sets it to true if truthy.
 * Example: "foo" => { foo: true },
 * Example: "" => {}
 * @param property Name of the property
 */
export function computedProperty(property?: string) {
  return property ? { [property]: true } : {}
}

/**
 * Tries to parse the argument (e.g. a JSON string) and return the result (e.g. an object).
 * Returns the argument if it's already an object.
 * Returns an empty object if argument is falsy.
 * @param json Something that will be parsed
 */
export function parseJson<T>(json: unknown): T | undefined {
  if (json instanceof Object) {
    return json as T
  }

  if (typeof json === "string") {
    try {
      return JSON.parse(json)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(e)
    }
  }

  return undefined
}

/**
 * Checks if a given element or one of its parents has "display: none;".
 * It won't work for "position: fixed;" and is untested for other ways of
 * making elements invisible (such as modifying height or position).
 * @param el Element to check.
 */
export function isHidden(el: HTMLElement): boolean {
  return el.offsetParent === null
}

/**
 * Checks if a given element is an SDX web component by testing its
 * tagname to start with "sdx-".
 * @param el Element to check.
 */
export function isSDXWebComponent(el: Element): boolean {
  return /^sdx-/.test(el.tagName.toLowerCase())
}

/**
 * Returns the element to which overlays are to be attached.
 */
export function getOverlayOutletEl(): HTMLElement {
  const overlayOutletEl = document.getElementById("sdx-overlay-outlet")

  // Make sure .sdx is present in case the it's used outside the container
  // and therefore misses font-face declarations, colors, etc.
  overlayOutletEl?.classList.add("sdx")

  return overlayOutletEl || document.body
}

/**
 * Returns the width of an element, optionally with padding and margin.
 * To use if .offsetWidth does not suffice.
 * @param el Element to measure.
 * @param includeMargin If there's margin, add it to the width.
 * @param includePadding If there's padding, add it to the width.
 */
export function width(
  el?: HTMLElement,
  includeMargin = false,
  includePadding = false,
): number {
  if (!el) {
    return 0
  }

  const style = getComputedStyle(el)
  const isHidden = style.display === "none"
  let width = el.offsetWidth

  if (includeMargin) {
    width = width + parseFloat(style.marginLeft) + parseFloat(style.marginRight)
  }

  if (!includePadding) {
    width =
      width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  }

  if (isHidden) {
    return 0
  }

  return width
}

export function isTextNode(node: Node): node is Element {
  return node.nodeType === Node.TEXT_NODE
}

export function isElementNode(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE
}

/**
 * Checks if a given node has a child with a given slot name (if any).
 * @param el Parent element to check.
 * @param name Slot name to check.
 */
export function hasSlot(el: Element, name?: string): boolean {
  if (name) {
    // This also works when el has no shadow root (e.g. sdx-header-menu)
    return !!el.querySelector(`[slot=${name}]`)
  } else {
    // Warning: this only works when el has a shadow root
    // @ts-ignore
    return [...el.childNodes].some(
      (node) =>
        isTextNode(node) || (isElementNode(node) && !node.hasAttribute("slot")),
    )
  }
}

/**
 * Flattens a recursively nested object.
 * @param data Array to be flattened.
 * @param property Property name of children.
 */
export function flattenBy<T>(
  data: T,
  property: keyof T,
  accumulator: T[] = [],
): T[] {
  accumulator.push(data)

  if (Array.isArray(data[property])) {
    ;(data[property] as any as T[]).forEach(
      // why isn't Array.isArray() enough for TS?
      (child) => flattenBy(child, property, accumulator),
    )
  }

  return accumulator
}

/**
 * Returns the numeric value of a computed style property.
 */
export function getNumericValue(
  computedStyleProperty: string,
  el: Element,
): number {
  const style = getComputedStyle(el)
  return parseFloat(style.getPropertyValue(computedStyleProperty))
}

export function isTouchscreen(): boolean {
  return "ontouchstart" in window
}

export function dispatchEvent(el: HTMLElement, type: string): void {
  el.dispatchEvent(
    new Event(type, { cancelable: true, bubbles: true, composed: true }),
  )
}

export function getScrollbarWidth(): number {
  // Same calculation that body-scroll-lock uses
  return window.innerWidth - document.documentElement.clientWidth
}

/**
 * Finds and returns the first scrollable parent element of a given element.
 */
export function getScrollContainerEl(el: Element): Element | undefined {
  let currentEl = el

  while (currentEl) {
    if (currentEl === document.body) {
      // Look no further
      return
    }

    const { overflow } = getComputedStyle(currentEl)
    const hasOverflowScroll =
      overflow.includes("auto") || overflow.includes("scroll")
    const hasScrollbar = currentEl.scrollHeight > currentEl.clientHeight

    // Just because an element has an "overflow" doesn't mean there's actually
    // a scrollbar. Therefore also check its scroll height.
    // Checking its scroll height alone doesn't work because in some cases,
    // the scrollHeight is larger than clientHeight even though it isn't
    // scrollable (e.g. for inline elements).
    if (hasOverflowScroll && hasScrollbar) {
      return currentEl
    }

    currentEl = parent(currentEl) as Element
  }

  return
}

/**
 * Tests an expression every n ms and resolves once true.
 * @param expression Expression to test.
 */
export function waitFor(fn: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (fn()) {
        clearInterval(interval)
        resolve()
      }
    }, 10)
  })
}

/**
 * Get correct scrolling values, even for Safari 12.
 */
export function getScrollTopLeft(
  elementWithPossiblyWrongScrollValues: Element,
) {
  if (elementWithPossiblyWrongScrollValues !== document.documentElement) {
    // values are ok
    return {
      scrollTop: elementWithPossiblyWrongScrollValues.scrollTop,
      scrollLeft: elementWithPossiblyWrongScrollValues.scrollLeft,
    }
  }

  const elementWithCorrectScrollValues =
    document.scrollingElement || document.documentElement

  return {
    scrollTop: elementWithCorrectScrollValues.scrollTop,
    scrollLeft: elementWithCorrectScrollValues.scrollLeft,
  }
}

/**
 * This method is used to add a hidden input element to a host element. It does not
 * add the input inside of the Shadow root which allows it to be submitted
 * inside of forms. It should contain the same values as the host element.
 * See https://github.com/ionic-team/ionic-framework/blob/6bcefcd9edd7e69bca8b7fb804ecafae8770e425/core/src/utils/helpers.ts#L355
 *
 * @param container The element where the input will be added
 * @param name The name of the input
 * @param value The value of the input
 * @param disabled (optional) If true, the input is disabled. Defaults to false.
 */
export const renderHiddenInput = (
  container: HTMLElement,
  name: string | undefined,
  value: any,
  disabled: boolean = false,
) => {
  let input = container.querySelector(
    "input.aux-input",
  ) as HTMLInputElement | null

  if (name || name === "") {
    if (!input) {
      input = container.ownerDocument.createElement("input")
      input.type = "hidden"
      input.classList.add("aux-input")
      container.appendChild(input)
    }

    input.disabled = disabled
    input.name = name
    input.value = value || ""
  } else if (input) {
    container.removeChild(input)
  }
}
