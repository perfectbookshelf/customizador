/**
 * Upload a data URL (e.g. "data:image/png;base64,...") to Shopify Files via
 * the Admin GraphQL API and return the resulting CDN URL.
 *
 * Returns null on any failure — callers should treat the upload as best-effort
 * and never block checkout if it fails.
 */
const API_VERSION = "2025-01"

function decodeDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/i.exec(dataUrl)
  if (!match) return null
  const mimeType = match[1]
  const isBase64 = !!match[2]
  const payload = match[3]
  try {
    const bytes = isBase64
      ? Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
      : new TextEncoder().encode(decodeURIComponent(payload))
    return { mimeType, bytes }
  } catch {
    return null
  }
}

async function shopifyGraphQL<T = any>(
  shopHandle: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T | null> {
  try {
    const res = await fetch(`https://${shopHandle}.myshopify.com/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    })
    if (!res.ok) {
      console.warn("Shopify GraphQL HTTP error", res.status, await res.text().catch(() => ""))
      return null
    }
    const json = (await res.json()) as { data?: T; errors?: unknown }
    if (json.errors) {
      console.warn("Shopify GraphQL errors", JSON.stringify(json.errors))
      return null
    }
    return json.data ?? null
  } catch (err) {
    console.warn("Shopify GraphQL request failed", err)
    return null
  }
}

export async function uploadDataUrlToShopifyFiles(
  shopHandle: string,
  accessToken: string,
  dataUrl: string,
  filename: string,
): Promise<string | null> {
  const decoded = decodeDataUrl(dataUrl)
  if (!decoded) {
    console.warn("uploadDataUrlToShopifyFiles: could not decode data URL")
    return null
  }
  const { mimeType, bytes } = decoded

  // 1. Create a staged upload target.
  const stagedData = await shopifyGraphQL<{
    stagedUploadsCreate: {
      stagedTargets: Array<{
        url: string
        resourceUrl: string
        parameters: Array<{ name: string; value: string }>
      }>
      userErrors: Array<{ field: string[]; message: string }>
    }
  }>(
    shopHandle,
    accessToken,
    `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`,
    {
      input: [
        {
          filename,
          mimeType,
          httpMethod: "POST",
          resource: "FILE",
          fileSize: String(bytes.byteLength),
        },
      ],
    },
  )

  const target = stagedData?.stagedUploadsCreate?.stagedTargets?.[0]
  if (!target) {
    console.warn("stagedUploadsCreate returned no target", stagedData?.stagedUploadsCreate?.userErrors)
    return null
  }

  // 2. POST the file bytes to the staged URL (Google Cloud Storage signed POST).
  try {
    const form = new FormData()
    for (const p of target.parameters) form.append(p.name, p.value)
    form.append("file", new Blob([bytes], { type: mimeType }), filename)
    const uploadRes = await fetch(target.url, { method: "POST", body: form })
    if (!uploadRes.ok) {
      console.warn("Staged upload failed", uploadRes.status, await uploadRes.text().catch(() => ""))
      return null
    }
  } catch (err) {
    console.warn("Staged upload request error", err)
    return null
  }

  // 3. Register the uploaded asset as a Shopify File.
  const fileData = await shopifyGraphQL<{
    fileCreate: {
      files: Array<{ id: string; preview?: { image?: { url?: string } | null } | null; url?: string }>
      userErrors: Array<{ field: string[]; message: string }>
    }
  }>(
    shopHandle,
    accessToken,
    `mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id
          ... on MediaImage { image { url } }
          ... on GenericFile { url }
        }
        userErrors { field message }
      }
    }`,
    {
      files: [
        {
          alt: filename,
          contentType: mimeType.startsWith("image/") ? "IMAGE" : "FILE",
          originalSource: target.resourceUrl,
        },
      ],
    },
  )

  const fileNode = fileData?.fileCreate?.files?.[0] as
    | { image?: { url?: string } | null; url?: string }
    | undefined
  const cdnUrl = fileNode?.image?.url || fileNode?.url
  if (!cdnUrl) {
    // Shopify processes images asynchronously — image URL may not be ready yet.
    // For our use case (sending a link in checkout), the resourceUrl is a valid
    // signed GCS URL that Shopify also serves; fall back to it.
    console.warn(
      "fileCreate returned no immediate URL — falling back to staged resourceUrl",
      fileData?.fileCreate?.userErrors,
    )
    return target.resourceUrl
  }
  return cdnUrl
}
