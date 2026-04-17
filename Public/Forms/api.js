const BACKEND = "http://localhost:5000";

async function submitToMongo(formType, data) {
  const res = await fetch(`${BACKEND}/api/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formType, data }),
  });

  const out = await res.json();

  if (!out.success) {
    throw new Error(out.error || out.message || "DB save failed");
  }

  return out; // { success: true, id: "..." }
}
