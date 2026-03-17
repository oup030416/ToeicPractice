import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { exportSyncWithDrillSets, loadDrillSetsFromDirectory } from '../shared/toeic-sync/drill-store'

function readArg(flag: string, args: string[]) {
  const index = args.indexOf(flag)
  return index === -1 ? null : args[index + 1] ?? null
}

async function main() {
  const args = process.argv.slice(2)
  const base = readArg('--base', args)
  const input = readArg('--input', args)
  const out = readArg('--out', args)

  if (!base || !input || !out) {
    throw new Error('사용법: npm run sync:export-drills -- --base sync/toeic_web_sync.json --input materials/drill_sets --out <output-path>')
  }

  const basePath = resolve(base)
  const inputDir = resolve(input)
  const outputPath = resolve(out)
  if (basePath === outputPath) {
    throw new Error('--out 경로는 base sync 파일과 같을 수 없습니다.')
  }

  const loaded = await loadDrillSetsFromDirectory(inputDir, { reviewedOnly: true })
  const result = await exportSyncWithDrillSets({
    baseSyncPath: basePath,
    drillSetPaths: loaded.map((entry) => entry.path),
    outputPath,
    reviewedOnly: true,
  })

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, JSON.stringify(result.sync, null, 2) + '\n', 'utf-8')

  process.stdout.write(
    `exported ${result.addedDrillSets.length} drill sets and ${result.addedEvents.length} events to ${outputPath}\n`,
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
