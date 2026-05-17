import { createServerFn } from "@tanstack/react-start";

interface RenderInput {
  imageDataUrl: string;
  finishLabel: string;
  typeLabel: string;
  dimensions: string;
}

/**
 * Canonical type "kinds" the AI photo render supports.
 * Anything else MUST be rejected before calling the AI provider.
 */
export type PhotoRenderKind = "bookshelf" | "horizontal" | "cathedral";

/** Labels that the configurator can send (TYPE_OPTIONS.label values). */
export const SUPPORTED_RENDER_TYPE_LABELS = ["Bookshelf", "Horizontal", "Cathedral"] as const;

/**
 * Classify the user-facing type label into one of the three supported AI
 * render kinds. Returns null if the type is not supported (Corner,
 * U-Surround, Portal, anything unknown).
 */
export function classifyRenderType(typeLabel: string): PhotoRenderKind | null {
  const t = String(typeLabel || "").trim().toLowerCase();
  if (!t) return null;
  if (t.includes("cathedral")) return "cathedral";
  if (t.includes("horizontal") || t.includes("rack")) return "horizontal";
  if (t === "bookshelf" || t.startsWith("bookshelf")) return "bookshelf";
  // Explicitly unsupported types we want to block:
  if (t.includes("corner") || t.includes("u-surround") || t.includes("usurround") || t.includes("portal")) {
    return null;
  }
  return null;
}

export interface BuiltRenderPrompt {
  kind: PhotoRenderKind;
  prompt: string;
  negativePrompt: string;
  typeGuidance: string;
  framingGuidance: string;
  finishLabel: string;
  typeLabel: string;
  dimensions: string;
}

/**
 * Pure prompt builder. No network calls, no secrets, no env reads.
 * Throws on unsupported types so callers fail fast before billing.
 */
export function buildRenderPrompt(input: {
  finishLabel: string;
  typeLabel: string;
  dimensions: string;
}): BuiltRenderPrompt {
  const finishLabel = String(input.finishLabel || "").slice(0, 120);
  const typeLabel = String(input.typeLabel || "").slice(0, 120);
  const dimensions = String(input.dimensions || "").slice(0, 120);

  const kind = classifyRenderType(typeLabel);
  if (!kind) {
    throw new Error(
      `Unsupported AI render type: "${typeLabel}". Supported: ${SUPPORTED_RENDER_TYPE_LABELS.join(", ")}.`,
    );
  }

  let typeGuidance = "";
  let framingGuidance = "";
  if (kind === "cathedral") {
    typeGuidance =
      "Render as a stepped/cathedral-shaped FREESTANDING bookshelf with a sloped/vaulted top profile, standing directly on the floor. The full base of the unit rests on the floor with realistic contact shadows.";
    framingGuidance =
      "The cathedral bookshelf should occupy around 55–70% of the image width, fully visible, standing directly on the floor.";
  } else if (kind === "horizontal") {
    typeGuidance =
      "Render as a LOW, WIDE, HORIZONTAL freestanding bookshelf (like a sideboard or media console) standing directly on the floor — NOT wall-mounted, NOT floating. The entire bottom edge touches the floor.";
    framingGuidance =
      "The horizontal bookshelf should occupy around 65–75% of the image width, fully visible, standing directly on the floor.";
  } else {
    typeGuidance =
      "Render as a TALL VERTICAL freestanding bookshelf standing directly on the floor. The entire bottom edge touches the floor.";
    framingGuidance =
      "The vertical bookshelf should occupy around 50–65% of the image height and 45–60% of the image width, fully visible, standing directly on the floor.";
  }

  const negativePrompt =
    "far away, tiny product, excessive empty floor, wide real estate photo, product too small, distant back wall, ultra-wide lens, cropped product, floating, hovering, levitating, suspended, wall-mounted, attached to the wall, hanging, mounted brackets, gap under the base, shadow below the object without floor contact, object not touching floor, unrealistic placement, floating UI preview shadow, product hovering above floor, drop-shadow halo under the unit";

  const prompt = `Re-render this 3D bookshelf model as an ultra-realistic photograph of the actual handcrafted piece of furniture in a real-world setting.

Furniture: ${typeLabel} bookshelf, ${dimensions}, finish: ${finishLabel}.

REFERENCE IMAGE USAGE (critical):
- The reference image is provided ONLY to convey the bookshelf's silhouette, proportions, module/compartment layout, shelf count, and finish.
- Do NOT copy lighting, framing, background, ground plane, or any shadow from the reference image into the final render.
- If the reference shows any soft shadow under the bookshelf, IGNORE IT. Treat the bookshelf as a solid freestanding object that must physically rest on a real floor in the new scene.

Type-specific guidance: ${typeGuidance}

GROUNDING (critical, do not deviate):
- The bookshelf is FREESTANDING, FLOOR-SUPPORTED furniture. It MUST stand directly on the floor with the entire bottom edge of its base in full contact with the floor across its whole footprint.
- Render natural, tight contact shadows ONLY where the wood base meets the floor, anchoring it visually.
- The base of the bookshelf must be clearly visible at the bottom of the frame, touching the floor — leave room below the unit to show the floor line.
- The bookshelf stands directly on the floor. The entire bottom edge/base touches the floor. Add realistic contact shadows only where the base meets the floor. It is not floating, not wall-mounted, not hovering, and not suspended.

FRAMING AND CAMERA (critical):
- Frame the bookshelf as the main subject of the image. Use a product-focused camera distance, not a wide real-estate room shot.
- ${framingGuidance}
- Camera at normal standing eye level or slightly lower, straight-on front perspective, realistic interior product photography, medium shot, balanced composition.
- Avoid excessive empty floor space in the foreground. Do not use an ultra-wide room perspective. Do not place the bookshelf far away on the back wall.

NEGATIVE — do NOT render any of: ${negativePrompt}. Do NOT add a black outline/frame unless the selected finish explicitly is black.

Geometry fidelity (critical):
- Preserve EXACTLY the same geometry, proportions, module layout, shelf count, compartment arrangement, and overall silhouette shown in the source image. Do not add, remove, or rearrange any compartments or shelves. Do not invent a different bookshelf shape.
- Replace the rendered surfaces with photorealistic solid hardwood matching the finish (${finishLabel}) — visible natural wood grain, subtle knots, warm tones, fine joinery details, slight chamfered edges. If the finish is walnut, use rich warm walnut tones with characteristic grain.

Scene:
- Tasteful minimal modern residential interior (real home living room or home office, NOT a gallery or loft). Standard residential ceiling height ~2.7m (~9ft) with the ceiling line visible at the top of the frame to anchor scale. Soft warm daylight from a side window, clean off-white plaster wall, warm oak or light wood plank residential flooring (NOT polished concrete).
- High-end editorial furniture catalog aesthetic (think MENU, Ferm Living, Vitsoe). Crisp focus on the bookshelf, subtle cinematic vignette, gentle ambient shadows, shallow depth of field.
- No people, no text, no logos, no books, no decorative objects on the shelves — leave the shelves empty so the structure reads clearly.
- The bookshelf fully visible with breathing room, base of the bookshelf clearly visible touching the floor.`;

  return { kind, prompt, negativePrompt, typeGuidance, framingGuidance, finishLabel, typeLabel, dimensions };
}

export const renderPhotoreal = createServerFn({ method: "POST" })
  .inputValidator((input: RenderInput) => {
    if (!input || typeof input.imageDataUrl !== "string" || !input.imageDataUrl.startsWith("data:image/")) {
      throw new Error("Invalid image input");
    }
    if (input.imageDataUrl.length > 8_000_000) {
      throw new Error("Image too large");
    }
    const typeLabel = String(input.typeLabel || "").slice(0, 120);
    if (!classifyRenderType(typeLabel)) {
      throw new Error(
        `Unsupported AI render type: "${typeLabel}". AI Photo Render is only available for: ${SUPPORTED_RENDER_TYPE_LABELS.join(", ")}.`,
      );
    }
    return {
      imageDataUrl: input.imageDataUrl,
      finishLabel: String(input.finishLabel || "").slice(0, 120),
      typeLabel,
      dimensions: String(input.dimensions || "").slice(0, 120),
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const { prompt } = buildRenderPrompt({
      finishLabel: data.finishLabel,
      typeLabel: data.typeLabel,
      dimensions: data.dimensions,
    });

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
