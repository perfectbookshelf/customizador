export interface ShelfConfig {
  height: number
  depth: number
}

export type BookshelfType = "rack" | "bookshelf" | "corner"

export interface BookshelfConfig {
  type: BookshelfType
  totalWidth: number
  width2?: number
  shelves: ShelfConfig[]
  shelves2?: ShelfConfig[]
  finish: string
}

export interface ModuleConfig {
  width: number
  height: number
  depth: number
}

export interface SKU {
  name: string
  type: string
  quantity: number
}

export interface BoardResult {
  width: number
  depth: number
  quantity: number
  shelfIndex: number
  skus: SKU[]
}

export interface ShelfResult {
  height: number
  depth: number
  modules: {
    width: number
    skus: SKU[]
  }[]
}

export interface BookshelfResult {
  config: BookshelfConfig
  totalHeight: number
  totalModules: number
  boards: BoardResult[]
  shelves: ShelfResult[]
  allSkus: {
    name: string
    type: string
    totalQuantity: number
  }[]
}
