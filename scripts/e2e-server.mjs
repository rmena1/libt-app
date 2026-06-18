import { spawn } from 'node:child_process'
import { resetDatabase } from './db-reset.mjs'

await resetDatabase()

const devServer = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    E2E_TRANSCRIPTION_TEXT: process.env.E2E_TRANSCRIPTION_TEXT || 'Reunion e2e de prueba. Se reviso el pipeline de transcripcion y se valido la escritura de bloques.',
  },
})

function stopDevServer(signal) {
  devServer.kill(signal)
}

process.on('SIGINT', stopDevServer)
process.on('SIGTERM', stopDevServer)

devServer.on('exit', (code) => {
  process.exit(code ?? 0)
})
