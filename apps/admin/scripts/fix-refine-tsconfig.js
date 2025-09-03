import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

function ensureFile(filePath, content) {
  const dir = dirname(filePath);
  try {
    mkdirSync(dir, { recursive: true });
  } catch {}
  if (!existsSync(filePath)) {
    writeFileSync(filePath, content, 'utf8');
    console.log(`Created ${filePath}`);
  } else {
    console.log(`Exists: ${filePath}`);
  }
}

(function main() {
  try {
    const nmRoot = join(process.cwd(), 'node_modules');
    const tsconfigBuildPath = join(nmRoot, 'tsconfig.build.json');
    const tsconfigPath = join(nmRoot, 'tsconfig.json');

    const minimal = JSON.stringify({ compilerOptions: { skipLibCheck: true } }, null, 2) + '\n';

    ensureFile(tsconfigBuildPath, minimal);
    ensureFile(tsconfigPath, minimal);

    console.log('TypeScript placeholder configs ensured in node_modules.');
  } catch (err) {
    console.error('Failed to ensure TypeScript placeholder configs:', err);
    process.exit(0); // Do not fail install due to this helper
  }
})();
