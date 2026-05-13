import { createFileRoute } from "@tanstack/react-router"
import { BookshelfConfigurator } from "@/components/BookshelfConfigurator"

const TITLE = "Perfect-Bookshelf — Custom Bookshelf Designer"
const DESCRIPTION =
  "Design your own custom bookshelf, cathedral, portal, or U-surround in minutes. Pick wood, finish, and dimensions, then order made-to-measure."
const URL = "https://create-yours.perfectbookshelf.com/"
const IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9cb593c8-bf52-403d-aa61-aaf64d265056/id-preview-6948177c--fbfb0bc5-6f44-4dcc-8e74-85731b03f64c.lovable.app-1778547201659.png"

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { property: "og:image", content: IMAGE },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: IMAGE },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "Bookshelf Designer",
          description: DESCRIPTION,
          image: IMAGE,
          brand: { "@type": "Brand", name: "Perfect-Bookshelf" },
          url: URL,
        }),
      },
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
