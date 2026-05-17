import { createServerFn } from "@tanstack/react-start";

export type PhotoRenderVariant = "hero" | "joinery" | "assembly";

interface RenderInput {
  imageDataUrl: string;
  finishLabel: string;
  typeLabel: string;
  dimensions: string;
  variant?: PhotoRenderVariant;
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
  if (t.includes("corner") || t.includes("u-surround") || t.includes("usurround") || t.includes("portal")) {
    return null;
  }
  return null;
}

export interface BuiltRenderPrompt {
  kind: PhotoRenderKind;
  variant: PhotoRenderVariant;
  prompt: string;
  negativePrompt: string;
  typeGuidance: string;
  framingGuidance: string;
  finishLabel: string;
  typeLabel: string;
  dimensions: string;
}

/**
 * Shared construction-system description so every variant communicates the
 * same modular, screw-free, baguette-based assembly logic.
 */
const SYSTEM_DESCRIPTION =
  "Perfect Bookshelf is a modular solid-hardwood shelving system. It is built from horizontal BOARDS and rectangular MODULES of various sizes. Each module is composed of exactly 1 back panel, 2 side panels, and 2 slim vertical baguettes (the baguettes are the interlocking structural fitting elements at the front edges of the module). Modules sit and interlock onto the boards through the baguettes. The whole system assembles WITHOUT any visible screws, brackets, hinges or fasteners — clean, precise, almost Lego-like but premium and architectural.";

/**
 * Pure prompt builder. No network calls, no secrets, no env reads.
 * Throws on unsupported types so callers fail fast before billing.
 */
export function buildRenderPrompt(input: {
  finishLabel: string;
  typeLabel: string;
  dimensions: string;
  variant?: PhotoRenderVariant;
}): BuiltRenderPrompt {
  const finishLabel = String(input.finishLabel || "").slice(0, 120);
  const typeLabel = String(input.typeLabel || "").slice(0, 120);
  const dimensions = String(input.dimensions || "").slice(0, 120);
  const variant: PhotoRenderVariant = input.variant ?? "hero";

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

  const baseNegative =
    "floating, hovering, levitating, suspended, wall-mounted, attached to the wall, hanging, mounted brackets, visible screws, visible fasteners, metal brackets, gap under the base, shadow below the object without floor contact, object not touching floor, unrealistic placement, floating UI preview shadow, drop-shadow halo under the unit, cropped product, far away, tiny product, excessive empty floor, wide real estate photo, ultra-wide lens";

  let prompt: string;
  let negativePrompt: string;

  if (variant === "hero") {
    negativePrompt = baseNegative;
    prompt = `Re-render this 3D bookshelf model as an ultra-realistic photograph of the actual handcrafted piece of furniture in a real-world setting.

Furniture: ${typeLabel} bookshelf, ${dimensions}, finish: ${finishLabel}.

PRODUCT SYSTEM CONTEXT: ${SYSTEM_DESCRIPTION}

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
- Replace the rendered surfaces with photorealistic solid hardwood matching the finish (${finishLabel}) — visible natural wood grain, subtle knots, warm tones, fine joinery details, slight chamfered edges. The construction reads as screw-free modular assembly (boards + modules + slim vertical baguettes at the front edges), but no hardware should be visible.

Scene:
- Tasteful minimal modern residential interior (real home living room or home office, NOT a gallery or loft). Standard residential ceiling height ~2.7m (~9ft) with the ceiling line visible at the top of the frame to anchor scale. Soft warm daylight from a side window, clean off-white plaster wall, warm oak or light wood plank residential flooring (NOT polished concrete).
- High-end editorial furniture catalog aesthetic (think MENU, Ferm Living, Vitsoe). Crisp focus on the bookshelf, subtle cinematic vignette, gentle ambient shadows, shallow depth of field.
- No people, no text, no logos, no books, no decorative objects on the shelves — leave the shelves empty so the structure reads clearly.
- The bookshelf fully visible with breathing room, base of the bookshelf clearly visible touching the floor.`;
  } else if (variant === "joinery") {
    negativePrompt =
      "visible screws, visible bolts, metal brackets, metal fasteners, hinges, nails, plastic clips, glue marks, messy joinery, rough edges, low quality, blurry, painted surface, plastic appearance, cartoon, illustration, line drawing, exploded view, multiple separated pieces, full room view, distant shot";
    prompt = `Ultra-realistic macro/close-up product photograph showing the CONSTRUCTION DETAIL of a Perfect Bookshelf module — the joinery / "encaixe" where modules interlock onto a horizontal board.

PRODUCT SYSTEM CONTEXT: ${SYSTEM_DESCRIPTION}

WHAT TO SHOW (critical):
- A tight close-up of one corner of a module sitting on a horizontal board, showing where the side panel, back panel, and the two slim vertical BAGUETTES meet the board.
- The two slim baguettes at the front edges of the module are the visible interlocking element — they sit cleanly against the side panels and onto the board, communicating that the module is held in place by precise fit, NOT by screws or hardware.
- Show crisp, precise hardwood joinery — flush surfaces, fine shadow lines between parts, slight chamfered edges, perfectly aligned grain. The viewer should immediately understand: "these parts fit together cleanly, no screws."
- Material: photorealistic solid hardwood in the selected finish (${finishLabel}) — visible natural wood grain, warm tones, fine craftsmanship.

FRAMING AND CAMERA:
- Macro / detail product photography, ~45° angled close-up. The board and the module corner with baguettes fill ~70–85% of the frame. Background softly blurred (shallow depth of field).
- Premium furniture-catalog lighting: soft directional daylight, subtle warm rim light, gentle contact shadows. Editorial, screw-free, engineered, precise.
- No people, no text, no logos, no books on the shelf, no decorative objects.

NEGATIVE — do NOT render any of: ${negativePrompt}. Absolutely no visible screws, bolts, brackets, or metal fasteners anywhere in the image.

REFERENCE IMAGE USAGE:
- Use the provided reference ONLY to match the finish/material and overall style of the same product family. Do NOT copy the full bookshelf silhouette into this shot — this image is intentionally a tight construction detail, not the whole unit.`;
  } else {
    // assembly
    negativePrompt =
      "photorealistic room, photograph, interior photography, books on shelves, decorative objects, people, complicated background, messy, cluttered, visible screws, visible fasteners, brackets, hardware, color photograph, heavy shading";
    prompt = `Clean, premium, ecommerce-ready EXPLODED / ASSEMBLY DIAGRAM that explains how a Perfect Bookshelf is built.

PRODUCT SYSTEM CONTEXT: ${SYSTEM_DESCRIPTION}

WHAT TO SHOW (critical):
- A didactic exploded-view / staged-assembly composition of a ${typeLabel.toLowerCase()} bookshelf, showing:
  1) horizontal BOARDS at the bottom (the structural base/shelves the modules sit on),
  2) several MODULES of different widths floating slightly above the boards with subtle directional arrows or implied vertical motion indicating they drop into place,
  3) at least one module rendered "open" so the viewer can see its composition: 1 back panel + 2 side panels + 2 slim vertical baguettes at the front edges,
  4) on one side of the composition, a more complete/assembled portion showing modules already stacked on boards into the final bookshelf shape.
- The progression should read left-to-right (or bottom-to-top) like an assembly sequence: parts → module → modules-on-board → finished bookshelf.
- Communicate clearly that the system is screw-free, modular, and stacks cleanly.

VISUAL STYLE (critical):
- Clean, minimal, premium product-instruction diagram. Light/neutral background (off-white or very light warm gray). Soft, even lighting, no harsh shadows.
- Rendered in tasteful 3D isometric or 3/4 axonometric view with thin elegant outlines and very light, warm wood fill in the ${finishLabel.toLowerCase()} finish family — refined enough to live on a premium ecommerce site.
- Subtle, minimal directional arrows where helpful to indicate how a module drops onto a board. Arrows must be thin, elegant, and unobtrusive.
- No text, no labels, no measurements, no logos, no books, no people.

NEGATIVE — do NOT render any of: ${negativePrompt}. This is NOT a room photo; it is a clean diagram-style render.

REFERENCE IMAGE USAGE:
- Use the provided reference ONLY to match the bookshelf type, proportions, module count, and finish family. Do NOT render a realistic room scene — render a clean exploded/assembly composition instead.`;
  }

  return { kind, variant, prompt, negativePrompt, typeGuidance, framingGuidance, finishLabel, typeLabel, dimensions };
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
    const rawVariant = String(input.variant ?? "hero");
    const variant: PhotoRenderVariant =
      rawVariant === "joinery" || rawVariant === "assembly" ? rawVariant : "hero";
    return {
      imageDataUrl: input.imageDataUrl,
      finishLabel: String(input.finishLabel || "").slice(0, 120),
      typeLabel,
      dimensions: String(input.dimensions || "").slice(0, 120),
      variant,
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const { prompt } = buildRenderPrompt({
      finishLabel: data.finishLabel,
      typeLabel: data.typeLabel,
      dimensions: data.dimensions,
      variant: data.variant,
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
    return { imageDataUrl: url, variant: data.variant };
  });
