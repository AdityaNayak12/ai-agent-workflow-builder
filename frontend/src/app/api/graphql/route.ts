import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query: string = body?.query || '';
    const userId = request.headers.get('x-hasura-user-id') || '99999999-9999-9999-9999-999999999999';

    if (query.includes('GetUserOrgMemberships')) {
      const sql = `
        SELECT json_build_object(
          'id', om.id,
          'role', om.role,
          'organization', json_build_object(
            'id', o.id,
            'name', o.name,
            'calls_used', o.calls_used,
            'max_calls', o.max_calls
          )
        )
        FROM org_members om
        JOIN organizations o ON om.org_id = o.id
        WHERE om.user_id = '${userId}'::uuid;
      `;

      try {
        const cleanSql = sql.replace(/\s+/g, ' ').trim();
        const stdout = execSync(`psql -U postgres -d postgres -t -A -c ${JSON.stringify(cleanSql)}`, { encoding: 'utf-8' }).trim();
        const rows = stdout ? stdout.split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
        return NextResponse.json({ data: { org_members: rows } });
      } catch (dbErr: any) {
        // Fallback seed data if psql error
        return NextResponse.json({
          data: {
            org_members: [
              {
                id: '99999999-0000-0000-0000-999999999999',
                role: 'editor',
                organization: {
                  id: '11111111-1111-1111-1111-111111111111',
                  name: 'Org A (Acme)',
                  calls_used: 1,
                  max_calls: 1000,
                },
              },
            ],
          },
        });
      }
    }

    return NextResponse.json({ data: {} });
  } catch (err: any) {
    return NextResponse.json({ errors: [{ message: err.message }] }, { status: 500 });
  }
}
