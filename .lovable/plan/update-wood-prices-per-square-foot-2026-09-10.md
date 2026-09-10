# Update wood prices per square foot

Replace the current rates in the finish list with the new price sheet.

| Finish | Current | New |
| --- | --- | --- |
| White Oak (Oak/Oak) | 73.63 | 94.13 |
| White Oak / Black (Oak/Black) | 78.94 | 107.73 |
| White Oak / White (Oak/White) | 72.57 | 95.36 |
| White (White/White) | 56.64 | 69.68 |
| Walnut (Walnut/Walnut) | 85.67 | 108.02 |
| Maple (Maple/Maple) | 60.18 | 67.97 |
| Maple / Black (Maple/Black) | 67.26 | 89.93 |
| Black (Black/Black) | 77.88 | 75.40 |

## Notes

- Only the `price` values in `FINISH_OPTIONS` change; labels, colors, textures, and "coming soon" flags stay as they are.
- The area math (bookshelf, corner, U-Surround, cathedral) is untouched — totals simply recalculate at the new rates.
- Quotes and Shopify checkout use the same total, so they pick up the new prices automatically.
