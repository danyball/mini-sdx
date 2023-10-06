import {
  Component,
  h,
  Element,
  State,
  Watch,
  Event,
  EventEmitter,
  Listen,
  Prop,
  Method,
} from "@stencil/core"
import {
  parseFunction,
  getPreviousFromList,
  getNextFromList,
  isHidden,
  StoreConnection,
  StateHandle,
  waitFor,
} from "../../utils/webcomponent-helpers"
import {
  tabsReducer,
  getInitialState,
  TabsState,
  TabsActions,
} from "./tabs-store"

@Component({
  tag: "sdx-tabs",
  styleUrl: "tabs.scss",
  shadow: true,
})
export class Tabs {
  private store: StoreConnection<this, TabsState, TabsActions>
  // @ts-ignore
  private componentEl?: HTMLDivElement
  private indicatorEl?: HTMLDivElement
  private tablistEl?: HTMLDivElement
  private isInitialLayout = true
  private componentDidLoadComplete = false
  private invokeChangeCallback: Function = () => null
  private selectedTabsItemElDidUpdate = false
  private tabsItemElsDidUpdate = false
  private resizeTimer?: NodeJS.Timer

  private tabsItemsWithClickableEl!: WeakMap<
    HTMLSdxTabsItemElement,
    HTMLButtonElement | HTMLAnchorElement
  >

  @Element() public el!: HTMLSdxTabsElement

  @State() public state!: StateHandle<TabsState>

  /**
   * Callback that will fire when the active tab has changed.
   * Provides the active tab DOM node.
   * @deprecated use sdxselect event instead.
   */
  @Prop() public changeCallback?: ((activeTab: Node) => void) | string

  /**
   * Description text read by the screen reader.
   */
  @Prop() public srHint: string = ""

  /**
   * Disable animations for testing.
   * @private
   */
  @Prop() public animated: boolean = true

  /**
   * Arranges the tabs appearance to be either left-aligned (default) or centralised.
   */
  @Prop() public theme: "left-aligned" | "centered" = "left-aligned"

  @Watch("state")
  public stateChanged({}, prev: StateHandle<TabsState>) {
    const state = this.state.get()
    const prevState = prev.get()

    if (state.selectedTabsItemEl !== prevState.selectedTabsItemEl) {
      this.selectedTabsItemElChanged(state)
    }

    if (state.tabsItemEls !== prevState.tabsItemEls) {
      this.tabsItemElsChanged()
    }
  }

  @Watch("changeCallback")
  public changeCallbackChanged() {
    this.setInvokeChangeCallback()
  }

  /**
   * Emitted when an item becomes visible.
   */
  @Event() public sdxselect!: EventEmitter

  @Listen("keydown", { target: "window" })
  public onKeyDown(e: KeyboardEvent) {
    // Only react to key events if the component is focussed
    if (e.target !== this.el) {
      return
    }

    const { tabsItemEls, selectedTabsItemEl } = this.state.get()
    let count = 0

    switch (e.key) {
      case "ArrowLeft": {
        e.preventDefault() // Prevent scrolling

        let prevEl = getPreviousFromList(tabsItemEls, selectedTabsItemEl)

        if (prevEl) {
          while (prevEl.disabled && count < tabsItemEls.length) {
            prevEl = getPreviousFromList(tabsItemEls, prevEl)
            count += 1
          }

          this.select(prevEl, true, true)
        }

        break
      }

      case "ArrowRight": {
        e.preventDefault() // Prevent scrolling

        let nextEl = getNextFromList(tabsItemEls, selectedTabsItemEl)

        if (nextEl) {
          while (nextEl.disabled && count < tabsItemEls.length) {
            nextEl = getNextFromList(tabsItemEls, nextEl)
            count += 1
          }

          this.select(nextEl, true, true)
        }

        break
      }

      default:
        break
    }
  }

  /**
   * Draws the layout. Useful to redraw the component when initially
   * rendered on a hidden parent (e.g. an sdx-tabs-item).
   */
  @Method()
  public async layout() {
    if (!isHidden(this.el)) {
      this.animateIndicatorElToSelectedTab()
      this.isInitialLayout = false
    }
  }

  @Listen("resize", { target: "window" })
  public onWindowResize() {
    clearTimeout(this.resizeTimer)
    this.resizeTimer = setTimeout(
      () => this.animateIndicatorElToSelectedTab(0),
      200,
    )
  }

  constructor() {
    this.setInvokeChangeCallback()

    this.store = new StoreConnection(this, tabsReducer, getInitialState(), [
      "tabsItemEls",
      "selectedTabsItemEl",
    ])

    this.store.flush()
  }

  /**
   * Delay the first render() until the first item has registered itself.
   * Otherwise, if sdx-tabs-item.entry.js wasn't fetched fast enough, the
   * initial render() happens too early (see below) and therefore calls
   * componentOnReady() too early.
   *
   * sdx-tabs: constructor()
   * sdx-tabs: render() <-- too early, couldn't render buttons yet
   * sdx-tabs-item: constructor()
   * sdx-tabs: componentDidLoad()
   *
   * Note: it was also tried to move this logic into componentDidRender(),
   * which is always called *after* all childrens componentDidLoad(), but it
   * didn't work because in componentDidLoad(), the bounding rect was still 0.
   *
   * Also created https://github.com/ionic-team/stencil/issues/3411.
   */
  public async componentWillLoad() {
    await waitFor(() => this.state.get().tabsItemEls.length > 0)

    this.selectDefaultTabsItem()
  }

  public componentDidLoad() {
    this.layout()

    this.store.subscribe()

    this.componentDidLoadComplete = true
  }

  public componentDidUpdate() {
    if (this.selectedTabsItemElDidUpdate) {
      this.invokeChangeCallback(this.state.get().selectedTabsItemEl)
      this.layout()

      this.selectedTabsItemElDidUpdate = false
    }

    if (this.tabsItemElsDidUpdate) {
      this.layout()

      this.tabsItemElsDidUpdate = false
    }
  }

  private selectedTabsItemElChanged(state: TabsState) {
    if (!this.componentDidLoadComplete) {
      return
    }

    // Ensure visibility of selected tabs item el (if any)
    if (!state.selectedTabsItemEl) {
      return
    }

    this.selectedTabsItemElDidUpdate = true
  }

  private tabsItemElsChanged() {
    this.tabsItemElsDidUpdate = true
  }

  private setInvokeChangeCallback(): void {
    this.invokeChangeCallback = parseFunction(this.changeCallback)
  }

  private getAnimationDuration(): number {
    if (!this.animated) {
      return 0
    }

    return this.isInitialLayout ? 0 : 200
  }

  /**
   * If no tabs item is selected initially, display the first one
   */
  private selectDefaultTabsItem(): void {
    const { selectedTabsItemEl, tabsItemEls } = this.state.get()

    if (!selectedTabsItemEl) {
      const defaultTabsItemEl = tabsItemEls.find((el) => !el.disabled)

      defaultTabsItemEl && this.select(defaultTabsItemEl)
    }
  }

  private animateIndicatorElToSelectedTab(
  // @ts-ignore
    animationDuration: number = this.getAnimationDuration(),
  ) {
    const { tabsItemEls, selectedTabsItemEl } = this.state.get()

    if (!selectedTabsItemEl) {
      this.indicatorEl!.style.display = "none"

      return
    }

    const firstClickableEl = this.tabsItemsWithClickableEl.get(tabsItemEls[0])!
    const selectedClickableEl =
      this.tabsItemsWithClickableEl.get(selectedTabsItemEl)!

    const tablistElRect = this.tablistEl!.getBoundingClientRect()
    const firstClickableElRect = firstClickableEl.getBoundingClientRect()
    const selectedClickableElRect = selectedClickableEl.getBoundingClientRect()

    const scrollLeft = tablistElRect.left - firstClickableElRect.left

    this.indicatorEl!.style.transform = `translateX(${selectedClickableElRect.left - tablistElRect.left - scrollLeft}px)`
    this.indicatorEl!.style.width = `${selectedClickableElRect.right - selectedClickableElRect.left}px`
    this.indicatorEl!.style.display = ""
  }

  private select(
    el: HTMLSdxTabsItemElement,
    isUserInteractionInProgress = false,
    selectedByArrowKeys = false,
  ) {
    this.store.set("isUserInteractionInProgress", isUserInteractionInProgress)
    this.store.set("selectedTabsItemEl", el)
    this.store.set("isUserInteractionInProgress", false)

    // If selected using the keyboard, ensure screen readers detect the change
    if (selectedByArrowKeys) {
      this.tabsItemsWithClickableEl.get(el)?.focus()
    }
  }

  private getComponentClassNames() {
    return {
      component: true,
      [this.theme]: true,
    }
  }

  private getClickableElClassNames(tabsItemEl: HTMLSdxTabsItemElement) {
    return {
      clickable: true,
      "button-reset": true,
      selected: tabsItemEl === this.state.get().selectedTabsItemEl,
    }
  }

  public render() {
    const { tabsItemEls, selectedTabsItemEl } = this.state.get()
    this.tabsItemsWithClickableEl = new WeakMap() // clear previous entries

    return (
      <div
        class={this.getComponentClassNames()}
        ref={(el) => (this.componentEl = el)}
      >
        <div class="header">
            <div
              class="tablist"
              role="tablist"
              aria-label={this.srHint}
              ref={(el) => (this.tablistEl = el)}
            >
              <div
                class="indicator"
                ref={(el) => (this.indicatorEl = el)}
                style={{
                  display: "none" /* will be displayed during animation */,
                }}
              />

              {tabsItemEls.map((tabsItemEl) => {
                const isSelected = tabsItemEl === selectedTabsItemEl
                const Tag = tabsItemEl.href ? "a" : "button"

                return (
                  <Tag
                    class={this.getClickableElClassNames(tabsItemEl)}
                    onClick={() => this.select(tabsItemEl, true)}
                    disabled={tabsItemEl.disabled && !tabsItemEl.href}
                    aria-disabled={tabsItemEl.disabled.toString()}
                    aria-selected={isSelected.toString()}
                    role="tab"
                    tabindex={isSelected ? "0" : "-1"}
                    href={tabsItemEl.href}
                    ref={(el) =>
                      el && this.tabsItemsWithClickableEl?.set(tabsItemEl, el)
                    }
                  >
                      {tabsItemEl.label}
                  </Tag>
                )
              })}
            </div>
        </div>

        <div class="body">
          <slot />
        </div>
      </div>
    )
  }
}
