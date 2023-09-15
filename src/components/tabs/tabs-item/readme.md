# sdx-tabs-item



<!-- Auto Generated Below -->


## Properties

| Property           | Attribute           | Description                                                                                                                                                                             | Type                                  | Default     |
| ------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------- |
| `disabled`         | `disabled`          | The tab is not selectable.                                                                                                                                                              | `boolean`                             | `false`     |
| `href`             | `href`              | Renders anchor element instead of a button. Can be useful for deep linking, SEO, etc.                                                                                                   | `string \| undefined`                 | `undefined` |
| `label`            | `label`             | Title of the tab.                                                                                                                                                                       | `string`                              | `""`        |
| `selected`         | `selected`          | The tab is active.                                                                                                                                                                      | `boolean`                             | `false`     |
| `selectedCallback` | `selected-callback` | <span style="color:red">**[DEPRECATED]**</span> use sdxselect event instead.<br/><br/>Callback that will fire when the tabs item has become visible. Also fires when opened by default. | `(() => void) \| string \| undefined` | `undefined` |


## Events

| Event       | Description                            | Type               |
| ----------- | -------------------------------------- | ------------------ |
| `sdxselect` | Emitted when the item becomes visible. | `CustomEvent<any>` |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
