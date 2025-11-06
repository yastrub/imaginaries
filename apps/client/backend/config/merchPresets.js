// Configurable merch presets and prompt builder
export const MERCH_STYLE_MAP = {
  GTA: 'make them GTA style looking.',
  GLAMOUR: 'make them glamorous, glossy editorial magazine style.',
  SUPERHERO: 'make them superhero comic cover style, bold dramatic lighting.',
  HIGH_FASHION: 'make them high fashion editorial style, avant-garde.',
};

export function buildMerchPrompt(preset = 'GTA', keepPoses = true) {
  const baseA = 'create a magazine cover with a logo provided and people on the photo.';
  const baseBKeep = 'retain original poses and faces of the people.';
  const baseBChange = 'change original poses, but keep faces of the people.';
  const baseC = 'Convert people into illustrations.';
  const baseD = 'Add magazine date Nov 08.';
  const style = MERCH_STYLE_MAP[preset] || MERCH_STYLE_MAP.GTA;
  const pose = keepPoses ? baseBKeep : baseBChange;
  const parts = [baseA, style, pose];
  if ((preset || '').toUpperCase() === 'GTA') {
    parts.push(baseC);
  }
  parts.push(baseD);
  return parts.join(' ');
}
