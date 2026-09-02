# Remove Portal type and verify U-Surround / Corner pricing

## 1. Remove Portal from the configurator

- Drop the "Portal" entry from the type list on Step 1, so it can no longer be selected.
- Handle returning visitors whose saved configuration says `portal`: on load, fall back to `bookshelf` so nobody lands on a dead type.
- Remove Portal-specific UI branches that are only reachable from that type: the Portal dimension panel, Portal schematic, Portal 3D view usage, and the Portal branch in the price/area calculation.
- Portal source files (`Portal3DView.tsx`, `PortalSchematic.tsx`, `portal-geometry.ts`) and their existing tests stay on disk, unreferenced by the configurator, so nothing else breaks. They can be deleted later if you want a full cleanup.

## 2. Re-verify pricing for U-Surround and Corner

Current formulas after the last change:

- Corner (outside): `height x (arm1 + arm2 - deepest shelf depth) / 144`
- Corner (inside): `height x (arm1 + arm2) / 144`
- U-Surround: `height x (left + back + right - 2 x deepest shelf depth) / 144`

Add an automated pricing test that, for a fixed finish rate, asserts:

- a Corner with two known arms produces the expected square footage and total;
- a U-Surround with three known walls produces the expected square footage and total, and that it is meaningfully larger than a single-wall bookshelf of the same back-wall width (proving the three walls are counted);
- switching finish changes the total by exactly the rate ratio.

Then run the suite and report the computed numbers for a sample Corner and U-Surround so you can sanity-check them against your price sheet.

## Technical notes

- Type union `MainType` loses `"portal"`; saved-state hydration coerces the old value.
- The pricing test targets the area/price math directly (extracted or exercised through the configurator render) rather than screenshots, so it stays fast and deterministic.
