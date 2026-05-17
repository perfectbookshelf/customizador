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

    const typeLower = data.typeLabel.toLowerCase()
    let typeGuidance = ""
    if (typeLower.includes("cathedral")) {
      typeGuidance =
        "Render as a stepped/cathedral-shaped FREESTANDING bookshelf with a sloped/vaulted top profile, standing directly on the floor. The full base of the unit rests on the floor with realistic contact shadows."
    } else if (typeLower.includes("horizontal") || typeLower.includes("rack")) {
      typeGuidance =
        "Render as a LOW, WIDE, HORIZONTAL freestanding bookshelf (like a sideboard or media console) standing directly on the floor — NOT wall-mounted, NOT floating. The entire bottom edge touches the floor."
    } else {
      typeGuidance =
        "Render as a TALL VERTICAL freestanding bookshelf standing directly on the floor. The entire bottom edge touches the floor."
    }

    const prompt = `Re-render this 3D bookshelf model as an ultra-realistic photograph of the actual handcrafted piece of furniture in a real-world setting.

Furniture: ${data.typeLabel} bookshelf, ${data.dimensions}, finish: ${data.finishLabel}.

REFERENCE IMAGE USAGE (critical):
- The reference image is provided ONLY to convey the bookshelf's silhouette, proportions, module/compartment layout, shelf count, and finish.
- Do NOT copy lighting, framing, background, ground plane, or any shadow from the reference image into the final render.
- If the reference shows any soft shadow under the bookshelf, IGNORE IT. Treat the bookshelf as a solid freestanding object that must physically rest on a real floor in the new scene.

Type-specific guidance: ${typeGuidance}

GROUNDING (critical, do not deviate):
- The bookshelf is FREESTANDING, FLOOR-SUPPORTED furniture. It MUST stand directly on the floor with the entire bottom edge of its base in full contact with the floor across its whole footprint.
- Render natural, tight contact shadows ONLY where the wood base meets the floor, anchoring it visually.
- The base of the bookshelf must be clearly visible at the bottom of the frame, touching the floor — leave room below the unit to show the floor line.
- NEGATIVE — do NOT render any of: floating, hovering, levitating, suspended, wall-mounted, attached to the wall, hanging, mounted brackets, gap under the base, shadow below the object without floor contact, object not touching floor, unrealistic placement, floating UI preview shadow, product hovering above floor, drop-shadow halo under the unit. Do NOT add a black outline/frame unless the selected finish explicitly is black.

Geometry fidelity (critical):
- Preserve EXACTLY the same geometry, proportions, module layout, shelf count, compartment arrangement, and overall silhouette shown in the source image. Do not add, remove, or rearrange any compartments or shelves. Do not invent a different bookshelf shape.
- Replace the rendered surfaces with photorealistic solid hardwood matching the finish (${data.finishLabel}) — visible natural wood grain, subtle knots, warm tones, fine joinery details, slight chamfered edges. If the finish is walnut, use rich warm walnut tones with characteristic grain.

Scene:
- Tasteful minimal modern residential interior (real home living room or home office, NOT a gallery or loft). Standard residential ceiling height ~2.7m (~9ft) with the ceiling line visible at the top of the frame to anchor scale. Soft warm daylight from a side window, clean off-white plaster wall, warm oak or light wood plank residential flooring (NOT polished concrete).
- High-end editorial furniture catalog aesthetic (think MENU, Ferm Living, Vitsoe). Crisp focus on the bookshelf, subtle cinematic vignette, gentle ambient shadows, shallow depth of field.
- No people, no text, no logos, no books, no decorative objects on the shelves — leave the shelves empty so the structure reads clearly.
- Square or 4:3 framing, the bookshelf fully visible with breathing room, base of the bookshelf clearly visible touching the floor.`;

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
