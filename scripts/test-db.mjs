import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { readFileSync, readdirSync } from 'node:fs'
const container = process.env.SUPABASE_TEST_CONTAINER || 'supabase_db_rugistan'
const db = `rugistan_audit_${Date.now()}`
const args = (database) => [
  'exec',
  '-i',
  container,
  'psql',
  '-X',
  '-q',
  '-A',
  '-t',
  '-v',
  'ON_ERROR_STOP=1',
  '-U',
  'postgres',
  '-d',
  database,
]
function sql(database, source) {
  return execFileSync('docker', args(database), {
    input: source,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}
let created = false
try {
  sql('postgres', `create database ${db};`)
  created = true
  let migrations = readFileSync('tests/database-bootstrap.sql', 'utf8')
  for (const name of readdirSync('supabase/migrations')
    .filter((x) => x.endsWith('.sql'))
    .sort()) {
    if (name.endsWith('_security_gateway.sql')) migrations += `
      insert into public.orders(id,order_number,email,first_name,last_name,address_line1,city,country,admin_note)
      values('90000000-0000-4000-8000-000000000001','MIGRATION-LEGACY','migration@example.test','Test','Buyer','Test St','Lahore','Pakistan',repeat('x',10001));
    `
    // pg_cron can be installed only in its configured database, usually postgres.
    migrations +=
      '\n' +
      readFileSync(`supabase/migrations/${name}`, 'utf8')
        .replace('create extension if not exists pg_cron;', '')
        .replace(
          "select cron.schedule('rugistan-expire-reservations','*/15 * * * *','select public.release_expired_reservations()');",
          '',
        )
  }
  sql(db, 'begin;\n' + migrations + '\ncommit;')
  if (sql(db, "select length(body) from public.order_admin_notes where order_id='90000000-0000-4000-8000-000000000001'").trim() !== '10001')
    throw new Error('Legacy staff note was not preserved')
  sql(db, "delete from public.orders where id='90000000-0000-4000-8000-000000000001';")
  console.log('PASS: migration preserves long legacy staff notes and cascading deletion.')
  const output = sql(db, readFileSync('supabase/tests/production_integrity.sql', 'utf8'))
  const checks = output.split('\n').filter((x) => /^(not )?ok \d+/.test(x))
  console.log(checks.join('\n'))
  if (output.includes('not ok') || /Looks like you/.test(output))
    throw new Error('Database regression failure')
  // Force the last-redemption race open. The promo row lock must serialize eligibility.
  sql(
    db,
    `insert into public.products(id,name,slug,sku,price,stock_quantity,status) values
    ('10000000-0000-4000-8000-000000000001','A','a','A',100,20,'published'),
    ('10000000-0000-4000-8000-000000000002','B','b','B',100,20,'published');
    insert into public.shipping_methods(id,name,amount) values('30000000-0000-4000-8000-000000000001','Shipping',0);
    insert into public.settings(key,value) values('store','{"currency":"USD"}'),('payments','{"offline_methods":[{"id":"cod","enabled":true}]}');
    insert into public.promo_codes(code,type,value,usage_limit) values('RACE','fixed',10,1);
    create function public.audit_delay_promo() returns trigger language plpgsql as $$begin perform pg_sleep(0.5); return new; end$$;
    create trigger audit_delay before update on public.promo_codes for each row execute function public.audit_delay_promo();`,
  )
  const run = promisify(execFile)
  const jobs = [1, 2].map((index) =>
    run('docker', [
      ...args(db),
      '-c',
      `select public.place_order('[{"product_id":"10000000-0000-4000-8000-00000000000${index}","quantity":1}]','{"email":"race${index}@example.test","first_name":"Race","last_name":"Test"}','{"address_line1":"Test St","city":"Lahore","country":"Pakistan"}','30000000-0000-4000-8000-000000000001','cod','RACE');`,
    ]),
  )
  const results = await Promise.allSettled(jobs)
  if (
    results.filter((x) => x.status === 'fulfilled').length !== 1 ||
    sql(db, "select used_count from public.promo_codes where code='RACE'").trim() !== '1' ||
    sql(db, 'select count(*) from public.orders').trim() !== '1'
  )
    throw new Error('Concurrent promotion redemption failed')
  console.log(`PASS: ${checks.length} database checks and concurrent last-redemption race.`)
  const quotas = await Promise.all(Array.from({ length: 12 }, () => run('docker', [
    ...args(db), '-c', "select public.consume_store_quota('checkout',repeat('c',64))->>'allowed';",
  ])))
  if (quotas.filter(result => result.stdout.trim() === 'true').length !== 5)
    throw new Error('Concurrent quota exceeded the fixed trusted-client budget')
  console.log('PASS: concurrent request quota (5 of 12 allowed).')

  sql(
    'postgres',
    "begin;create extension if not exists pg_cron;select cron.schedule('rugistan-audit-scheduler-validation','*/15 * * * *','select 1');rollback;",
  )
  console.log('PASS: pg_cron scheduling syntax (rolled back).')
} finally {
  if (created) sql('postgres', `drop database ${db};`)
}
