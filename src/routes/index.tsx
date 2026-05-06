import { createFileRoute } from "@tanstack/react-router"
import { BookshelfConfigurator } from "@/components/BookshelfConfigurator"

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bookshelf Designer" },
      { name: "description", content: "Design your custom bookshelf, cathedral, portal, or U-surround." },
    ],
  }),
  component: Index,
})

function Index() {
  return (
    <main className="bg-background">
      <BookshelfConfigurator />
    </main>
  )
}
