// Configurable merch presets and prompt builder
export const MERCH_STYLE_MAP = {
  GTA: 'convert them into 100% GTA-style illustration poster.',
  GLAMOUR: 'convert them into 100% glamour style poster.',
  SUPERHERO: 'convert them into 100% superhero themed poster.',
  HIGH_FASHION: 'convert them into 100% high fashion editorial style, avant-garde poster.',
  MINECRAFT: 'convert them into 100% Minecraft-style voxel art poster.',
  '007_AGENT': 'convert them into 100% James Bond 007 spy movie poster.',
  BARBIE: 'convert them into 100% Barbie-style pink glamorous poster.',
  ANIME: 'convert them into 100% anime style illustration poster.',
};

export function buildMerchPrompt(preset = 'GTA', keepPoses = true, brand = 'ARTIFICIAL') {
  const brandUpper = (brand || 'ARTIFICIAL').toUpperCase();
  const baseA = brandUpper === 'TECHTUESDAYS'
    ? 'create a magazine cover with people on the photo.'
    : 'create a magazine cover with a logo provided and people on the photo.';
  const baseBKeep = 'RETAIN original POSES and FACES of the people.';
  const baseBChange = 'CHANGE original POSES, but KEEP FACES of the people.';
  const baseD = brandUpper === 'TECHTUESDAYS' ? 'Add magazine ISSUE 71.' : 'Add magazine date Nov 08.';
  const style = MERCH_STYLE_MAP[preset] || MERCH_STYLE_MAP.GTA;
  const pose = keepPoses ? baseBKeep : baseBChange;
  const parts = [baseA, style, pose];
  if (brandUpper === 'TECHTUESDAYS') {
    parts.push('Use TECHTUESDAYS magazine title prominently at the top.');
  }
  parts.push(baseD);
  return parts.join(' ');
}
