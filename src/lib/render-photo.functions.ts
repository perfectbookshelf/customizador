import { createServerFn } from "@tanstack/react-start";

interface RenderInput {
  imageDataUrl: string;
  finishLabel: string;
  typeLabel: string;
  dimensions: string;
}

export const renderPhotoreal = createServerFn({ method: "POST" })
  .inputValidator((input: RenderInput) => {
    if (!input || typeof input.imageDataUrl !== "string" || !input.imageDataUrl.startsWith("data:image/")) {
      throw new Error("Invalid image input");
    }
    if (input.imageDataUrl.length > 8_000_000) {
      throw new Error("Image too large");
    }
    return {
      imageDataUrl: input.imageDataUrl,
      finishLabel: String(input.finishLabel || "").slice(0, 120),
      typeLabel: String(input.typeLabel || "").slice(0, 120),
      dimensions: String(input.dimensions || "").slice(0, 120),
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const prompt = `Re-render this 3D bookshelf model as an ultra-realistic photograph of the actual handcrafted piece of furniture in a real-world setting.

Furniture: ${data.typeLabel} bookshelf, ${data.dimensions}, finish: ${data.finishLabel}.

Critical requirements:
- Preserve EXACTLY the same geometry, proportions, module layout, shelf arrangement, and overall composition shown in the source image. Do not add, remove, or rearrange any compartments.
- Replace the rendered surfaces with photorealistic solid hardwood matching the finish (${data.finishLabel}) — visible natural wood grain, subtle knots, warm tones, fine joinery details, slight chamfered edges.
- Place it in a tasteful, minimal modern residential interior (a real home living room or home office, NOT a gallery or loft space). The ceiling MUST be at standard residential height of 2.7m (~9ft) — the ceiling line should be visible at the top of the frame to anchor the scale. Soft warm daylight from a side window, clean off-white plaster wall, warm oak or light wood floor (residential plank flooring, not polished concrete gallery floor), gentle ambient shadows, shallow depth of field.
- High-end editorial furniture catalog aesthetic (think MENU, Ferm Living, Vitsoe). Crisp focus on the bookshelf, slight cinematic vignette.
- No people, no text, no logos, no books, no decorative objects on the shelves — leave the shelves empty so the structure reads clearly.
- Square or 4:3 framing, the bookshelf fully visible with breathing room.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in workspace settings.");
      throw new Error(`Render failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{
        message?: {
          images?: Array<{ image_url?: { url?: string } }>;
          content?: string;
        };
      }>;
    };

    const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) throw new Error("No image returned by AI");
    return { imageDataUrl: url };
  });
