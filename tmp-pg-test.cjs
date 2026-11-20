const { Pool } = require("pg");
(async () => {
  const pool = new Pool({ connectionString: "postgresql://postgres:postgres@127.0.0.1:5433/postgres", max: 1 });
  const v = await pool.query("select version() as v, 1+1 as n");
  console.log(v.rows[0]);
  await pool.query("create table if not exists t(id text primary key, amt int)");
  await pool.query("insert into t values ($1,$2) on conflict (id) do update set amt = excluded.amt", ["a", 500]);
  const r = await pool.query("select * from t");
  console.log(r.rows);
  const c = await pool.connect();
  await c.query("begin"); await c.query("insert into t values ('b', 100)"); await c.query("rollback"); c.release();
  console.log((await pool.query("select count(*)::int as c from t")).rows);
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
