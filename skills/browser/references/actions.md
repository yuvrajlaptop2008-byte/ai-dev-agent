# Browser Action Reference

| Action | Fields |
|---|---|
| click | `{type:"click", selector}` |
| type | `{type:"type", selector, text}` |
| wait | `{type:"wait", ms}` |
| screenshot | `{type:"screenshot"}` |

Selectors are CSS selectors. If a selector doesn't match, the action is skipped with a logged
failure rather than crashing the whole sequence — check the returned log for `"... failed:"`
entries and adjust.
