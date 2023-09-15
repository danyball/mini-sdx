import { Reducer } from "redux"
import { sortByAppearanceInDomTree } from "../../utils/webcomponent-helpers"
import { add, remove } from "../../utils/immutability-helpers"

export interface TabsState {
  tabsItemEls: HTMLSdxTabsItemElement[]
  selectedTabsItemEl?: HTMLSdxTabsItemElement
  isUserInteractionInProgress: boolean
}

export type TabsActions =
  | { type: "ADD_TABS_ITEM_EL"; tabsItemEl: HTMLSdxTabsItemElement }
  | { type: "REMOVE_TABS_ITEM_EL"; tabsItemEl: HTMLSdxTabsItemElement }
  | { type: "DESELECT_TABS_ITEM_EL"; tabsItemEl: HTMLSdxTabsItemElement }
  | { type: "RESET_TABS_ITEM_ELS" }

export const tabsReducer: Reducer<TabsState, TabsActions> = (
  state = {} as TabsState,
  action,
): TabsState => {
  switch (action.type) {
    case "ADD_TABS_ITEM_EL":
      return {
        ...state,
        tabsItemEls: add(state.tabsItemEls, action.tabsItemEl).sort(
          sortByAppearanceInDomTree,
        ),
      }

    case "REMOVE_TABS_ITEM_EL":
      return {
        ...state,
        tabsItemEls: remove(state.tabsItemEls, action.tabsItemEl).sort(
          sortByAppearanceInDomTree,
        ),
      }

    case "DESELECT_TABS_ITEM_EL":
      if (state.selectedTabsItemEl === action.tabsItemEl) {
        return { ...state, selectedTabsItemEl: undefined }
      }

      return state

    case "RESET_TABS_ITEM_ELS":
      // Simply trigger change detection
      return { ...state, tabsItemEls: [...state.tabsItemEls] }

    default:
      return state
  }
}

export function getInitialState(): TabsState {
  return {
    tabsItemEls: [],
    selectedTabsItemEl: undefined,
    isUserInteractionInProgress: false,
  }
}
