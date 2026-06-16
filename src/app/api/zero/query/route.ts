import { NextResponse } from 'next/server'
import { handleQueryRequest } from '@rocicorp/zero/server'
import { mustGetQuery } from '@rocicorp/zero'
import { getSession } from '@/lib/auth'
import { queries } from '@/zero/queries'
import { schema } from '@/zero/schema'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ctx = { userID: session.id }

  const [tag, result] = await handleQueryRequest(
    (name, args) => {
      const query = mustGetQuery(queries, name)
      return query.fn({ args, ctx })
    },
    schema,
    request,
  )

  if (tag === 'transformFailed') {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}

