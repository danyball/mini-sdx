import {
  Component,
  h,
  Element,
  State,
  Prop,
  Watch,
  Event,
  EventEmitter,
  Host,
} from "@stencil/core"
import {
  StoreConnection,
  isSDXWebComponent,
  parseFunction,
  StateHandle,
} from "../../../utils/webcomponent-helpers"
import {
  tabsReducer,
  getInitialState,
  TabsState,
  TabsActions,
} from "../tabs-store"

@Component({
  tag: "sdx-tabs-item",
  styleUrl: "tabs-item.scss",
  shadow: true,
})
export class TabsItem {
  private store: StoreConnection<this, TabsState, TabsActions>
  private selectedChangedInProgress = false
  private invokeSelectedCallback: Function = () => null
  private onComponentDidUpdate: Function[] = []

  @Element() public el!: HTMLSdxTabsItemElement

  @State() public state!: StateHandle<TabsState>

  /**
   * Callback that will fire when the tabs item has become visible.
   * Also fires when opened by default.
   * @deprecated use sdxselect event instead.
   */
  @Prop() public selectedCallback?: (() => void) | string

  /**
   * Title of the tab.
   */
  @Prop() public label: string = ""

  /**
   * The tab is not selectable.
   */
  @Prop() public disabled: boolean = false

  /**
   * The tab is active.
   */
  @Prop({ mutable: true }) public selected: boolean = false

  /**
   * Renders anchor element instead of a button. Can be useful for deep linking, SEO, etc.
   */
  @Prop() public href?: string

  @Watch("state")
  public stateChanged({}, prev: StateHandle<TabsState>) {
    const state = this.state.get()
    const prevState = prev.get()

    if (state.selectedTabsItemEl !== prevState.selectedTabsItemEl) {
      this.selectedTabsItemElChanged(state)
    }
  }

  @Watch("selectedCallback")
  public selectedCallbackChanged() {
    this.setInvokeSelectedCallback()
  }

  @Watch("selected")
  public selectedChanged() {
    this.selectedChangedInProgress = true

    if (this.selected) {
      this.store.set("selectedTabsItemEl", this.el)
    }

    this.selectedChangedInProgress = false
  }

  @Watch("label")
  @Watch("disabled")
  @Watch("href")
  public propChanged() {
    this.store.dispatch({ type: "RESET_TABS_ITEM_ELS" })
  }

  /**
   * Emitted when the item becomes visible.
   */
  @Event() public sdxselect!: EventEmitter

  constructor() {
    this.setInvokeSelectedCallback()

    this.store = new StoreConnection(this, tabsReducer, getInitialState(), [
      "selectedTabsItemEl",
    ])
  }

  public connectedCallback() {
    // Register self
    this.store.dispatch({
      type: "ADD_TABS_ITEM_EL",
      tabsItemEl: this.el,
    })

    if (this.selected) {
      this.store.set("selectedTabsItemEl", this.el)
    }
  }

  public disconnectedCallback() {
    this.store.dispatch({ type: "DESELECT_TABS_ITEM_EL", tabsItemEl: this.el })

    this.store.dispatch({
      type: "REMOVE_TABS_ITEM_EL",
      tabsItemEl: this.el,
    })
  }

  public componentDidLoad() {
    this.store.subscribe()
  }

  public componentDidUpdate() {
    this.onComponentDidUpdate.forEach((fn) => fn())
    this.onComponentDidUpdate = []
  }

  private selectedTabsItemElChanged(state: TabsState) {
    if (!this.selectedChangedInProgress) {
      this.selected = state.selectedTabsItemEl === this.el
    }

    // Make sure events are fired *after* the layout has rendered.
    this.onComponentDidUpdate.push(() => {
      if (this.selected) {
        this.layout()

        if (state.isUserInteractionInProgress) {
          this.sdxselect.emit()
        }

        this.invokeSelectedCallback(state.selectedTabsItemEl)
      }
    })
  }

  private setInvokeSelectedCallback(): void {
    this.invokeSelectedCallback = parseFunction(this.selectedCallback)
  }

  // Run layout() on all SDX web components on the tab.
  private layout() {
    const children = this.el.querySelectorAll("*")

    children.forEach((child: Element & { layout?: Function }) => {
      if (isSDXWebComponent(child) && typeof child.layout === "function") {
        child.layout()
      }
    })
  }

  private getComponentClassNames() {
    return {
      component: true,
      selected: this.el === this.state.get().selectedTabsItemEl,
      disabled: this.disabled,
    }
  }

  public render() {
    return (
      <Host
        role="tabpanel"
        aria-label={this.label}
        tabindex={this.selected ? "0" : "-1"}
      >
        <div class={this.getComponentClassNames()}>
          <slot />
        </div>
      </Host>
    )
  }
}
