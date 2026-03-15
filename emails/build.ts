import { render } from "@react-email/render";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const EMAILS_DIR = import.meta.dir;
const OUTPUT_DIR = join(EMAILS_DIR, "..", "supabase", "templates");

await mkdir(OUTPUT_DIR, { recursive: true });

const glob = new Bun.Glob("*.tsx");

for await (const file of glob.scan({ cwd: EMAILS_DIR })) {
  const mod = await import(join(EMAILS_DIR, file));
  const Component = mod.default;
  const html = await render(Component());
  const name = basename(file, ".tsx");
  const outPath = join(OUTPUT_DIR, `${name}.html`);
  await writeFile(outPath, html);
  console.log(`Built: ${name}.html`);
}
