# Large-map performance baseline (v1.16.0)

This document describes local development baselines, not a cross-device performance guarantee. No node title, remark, path, or map content is recorded in diagnostics.

## MVP behavior

- Runtime indexes (`nodeById`, parent/child, depth, ancestors, descendant count and flattened IDs) are rebuilt only when the map tree changes and are never saved to `.lmind`.
- Maps above 300 nodes use viewport culling by default. The world viewport is derived from the current pan, zoom, and canvas size, with 220 screen pixels of overscan.
- Selected, editing, dragging, drop-target, and focused-root nodes remain rendered even outside the viewport.
- Focus is view-only: it lays out only the selected subtree but leaves the complete tree available to save, history, and plugins.
- The outline is a fixed-height, virtualized list; it only renders visible rows plus overscan.
- Image export temporarily disables viewport culling and expands the full tree in a derived render-only layout; the previous focus/collapse/view state is restored in `finally`.

## Baseline procedure

Use the in-app **性能测试** panel to generate 100, 500, 1000, or 3000 nodes with a fixed seed. Record machine details and the reported generation, serialization, layout, search, save, and export timings here when running a release benchmark. Timing assertions must not be used as strict CI failures.

| Nodes | Index | First layout | Search | Save | Export | Rendered DOM nodes |
|---:|---:|---:|---:|---:|---:|---:|
| 100 | manual baseline | manual baseline | manual baseline | manual baseline | manual baseline | all |
| 500 | manual baseline | manual baseline | manual baseline | manual baseline | manual baseline | viewport-dependent |
| 1000 | manual baseline | manual baseline | manual baseline | manual baseline | manual baseline | viewport-dependent |
| 3000 | manual baseline | manual baseline | manual baseline | manual baseline | manual baseline | viewport-dependent |

## Known MVP limits

- Layout remains whole-subtree layout; collapse and focus prune that subtree, while incremental layout is a later optimization.
- A future export dialog can add cancellation at the native file-write boundary and an explicit “current focused branch” export choice.
