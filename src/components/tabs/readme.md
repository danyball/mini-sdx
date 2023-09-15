# sdx-tabs



<!-- Auto Generated Below -->


## Properties

| Property         | Attribute         | Description                                                                                                                                                                      | Type                                    | Default          |
| ---------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------- |
| `animated`       | `animated`        | Disable animations for testing.                                                                                                                                                  | `boolean`                               | `true`           |
| `changeCallback` | `change-callback` | <span style="color:red">**[DEPRECATED]**</span> use sdxselect event instead.<br/><br/>Callback that will fire when the active tab has changed. Provides the active tab DOM node. | `((activeTab: Node) => void) \| string` | `undefined`      |
| `srHint`         | `sr-hint`         | Description text read by the screen reader.                                                                                                                                      | `string`                                | `""`             |
| `theme`          | `theme`           | Arranges the tabs appearance to be either left-aligned (default) or centralised.                                                                                                 | `"centered" \| "left-aligned"`          | `"left-aligned"` |


## Events

| Event       | Description                           | Type               |
| ----------- | ------------------------------------- | ------------------ |
| `sdxselect` | Emitted when an item becomes visible. | `CustomEvent<any>` |


## Methods

### `layout() => Promise<void>`

Draws the layout. Useful to redraw the component when initially
rendered on a hidden parent (e.g. an sdx-tabs-item).

#### Returns

Type: `Promise<void>`




----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
