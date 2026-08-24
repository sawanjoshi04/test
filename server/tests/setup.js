import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, '..')
const dbPath = path.join(serverRoot, 'prisma', 'test.db')

fs.rmSync(dbPath, { force: true })

process.env.DATABASE_URL = 'file:./test.db'

const prismaCli = path.join(serverRoot, 'node_modules', 'prisma', 'build', 'index.js')
execSync(`node ${JSON.stringify(prismaCli)} db push --skip-generate`, {
  cwd: serverRoot,
  stdio: 'pipe',
})