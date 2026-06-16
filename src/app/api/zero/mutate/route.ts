import { NextResponse } from 'next/server'
import { handleMutateRequest } from '@rocicorp/zero/server'
import { mustGetMutator } from '@rocicorp/zero'
import { getSession } from '@/lib/auth'
import { dbProvider } from '@/zero/db-provider'
import { mutators } from '@/zero/mutators'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ctx = { userID: session.id }

  const result = await handleMutateRequest(
    dbProvider,
    async (transact) => {
      return transact(async (tx, mutatorName, mutatorArgs) => {
        const mutator = mustGetMutator(mutators, mutatorName)
        await mutator.fn({ tx, ctx, args: mutatorArgs })
      })
    },
    request,
  )

  return NextResponse.json(result)
}

