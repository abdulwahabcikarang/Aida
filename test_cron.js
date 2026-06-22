async function test() {
  const res = await fetch('http://127.0.0.1:3000/api/cron', { method: 'POST' });
  const text = await res.text();
  console.log("STATUS:", res.status);
  console.log("RESPONSE:", text);
}
test();
