export const SHOWCASE_TRAVEL = 2000
const ITEM_WIDTH = 250
const ITEM_GAP = 32

// Include the end of the animated track and one extra tile at the viewport edge.
export function getShowcaseItemCount(viewportWidth: number) {
  return Math.ceil((Math.max(0, viewportWidth) + SHOWCASE_TRAVEL) / (ITEM_WIDTH + ITEM_GAP)) + 1
}
