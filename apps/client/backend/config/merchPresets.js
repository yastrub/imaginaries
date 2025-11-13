// Configurable merch presets and prompt builder
export const MERCH_STYLE_MAP = {
  GTA: 'convert them into 100% PRO grade GTA style.',
  GLAMOUR: 'convert them into 100% PRO grade GLAMOUR style, improve scene, lighting, composition, outfit.',
  SUPERHERO: 'convert them into 100% PRO grade superhero cinematic scene. Improve scene, lighting, composition, outfit.',
  HIGH_FASHION: 'convert them into 100% PRO grade high fashion editorial style, avant-garde poster.',
  MINECRAFT: 'convert them into 100% Minecraft-style voxel art poster.',
  '007_AGENT': 'convert them into 100% James Bond 007 spy movie poster.',
  BARBIE: 'convert them into 100% photorealistic editorial Barbie-style pink glamorous poster.',
  ANIME: 'convert them into 100% anime style illustration poster.',
};

export function buildMerchPrompt(preset = 'GTA', keepPoses = true, brand = 'ARTIFICIAL') {
  const brandUpper = (brand || 'ARTIFICIAL').toUpperCase();
  const baseA = brandUpper === 'TECHTUESDAYS'
    ? 'create a magazine cover with people on the photo.'
    : 'create a magazine cover with a logo provided and people on the photo.';
  const baseBKeep = 'RETAIN original POSES and FACES of the people.';
  const baseBChange = 'CHANGE original POSES, but KEEP original FACES of the people.';
  const baseC = 'convert people into illustration / comics.';
  const headlines = 'add only one smart / dope headline related to the scene, no other headlines.';
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'short' });
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${month} ${day}`;
  const baseD = brandUpper === 'TECHTUESDAYS' ? 'Add magazine ISSUE 71.' : `Add magazine date ${dateStr}.`;
  const style = MERCH_STYLE_MAP[preset] || MERCH_STYLE_MAP.GTA;
  const pose = keepPoses ? baseBKeep : baseBChange;
  const parts = [baseA, style, pose];
  if (brandUpper === 'TECHTUESDAYS') {
    parts.push('Use TECHTUESDAYS magazine title prominently at the top.');
  }
  if (["GTA", "ANIME"].includes(String(preset || '').toUpperCase())) {
    parts.push(baseC);
  }
  parts.push(baseD);
  parts.push(headlines);
  return parts.join(' ');
}
