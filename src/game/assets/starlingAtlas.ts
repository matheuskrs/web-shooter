import type { SpritesheetData, SpritesheetFrameData } from 'pixi.js';

/**
 * The ships atlas ships as a Starling/Sparrow XML file, which Pixi does not
 * read natively. Converting it to Pixi's JSON-style data at load time keeps
 * the original asset untouched and lets the whole fleet share one texture.
 * Frame names drop the ".png" suffix: "ship_3.png" becomes "ship_3".
 */
export function parseStarlingAtlas(xml: string, imageName: string): SpritesheetData {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('Invalid texture atlas XML');

  const frames: Record<string, SpritesheetFrameData> = {};
  for (const node of Array.from(document.querySelectorAll('SubTexture'))) {
    const name = node.getAttribute('name')?.replace(/\.png$/, '');
    if (!name) continue;
    const w = Number(node.getAttribute('width'));
    const h = Number(node.getAttribute('height'));
    frames[name] = {
      frame: { x: Number(node.getAttribute('x')), y: Number(node.getAttribute('y')), w, h },
      sourceSize: { w, h },
      spriteSourceSize: { x: 0, y: 0, w, h },
    };
  }
  return { frames, meta: { image: imageName, scale: 1 } };
}
