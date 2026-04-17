// form8.js (FINAL - Local JSON + MongoDB Save)

function $(id){ return document.getElementById(id); }
const cells = Array.from(document.querySelectorAll(".cell"));
const btnClear = $("btnClear");
const btnSave  = $("btnSave");
const btnLoad  = $("btnLoad");
const fileLoad = $("fileLoad");

function snapshot(){
  const data = {};
  cells.forEach(inp => {
    const k = inp.getAttribute("data-k");
    data[k] = (inp.value || "").trim();
  });
  return data;
}

function restore(data){
  cells.forEach(inp => {
    const k = inp.getAttribute("data-k");
    inp.value = (data && data[k]) ? data[k] : "";
  });
}

function clearAll(){
  cells.forEach(inp => inp.value = "");
}

function downloadJson(filename, obj){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type:"application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

function genRefNo(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  const rand = Math.floor(1000 + Math.random()*9000);
  return `FORM8-${y}${m}${day}-${rand}`;
}

// ✅ SAVE to MongoDB (one time)
async function saveForm8ToMongoOnce(refNo, payload){
  const key = "GP_FORM8_SAVED_" + refNo;
  if (localStorage.getItem(key) === "YES") return { skipped:true };

  const r = await submitToMongo("houseTax", payload);
  if (r && r.success){
    localStorage.setItem(key, "YES");
  }
  return r;
}

btnClear?.addEventListener("click", () => {
  if(confirm("Clear all fields?")) clearAll();
});

btnLoad?.addEventListener("click", () => fileLoad.click());

fileLoad?.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if(!file) return;

  try{
    const txt = await file.text();
    const json = JSON.parse(txt);
    restore(json.formData || json); // support both formats
    alert("✅ Loaded!");
  }catch(err){
    alert("❌ Invalid JSON file");
  }finally{
    fileLoad.value = "";
  }
});

btnSave?.addEventListener("click", async () => {
  const formData = snapshot();

  // ✅ Create reference no (keep same if already created)
  let refNo = localStorage.getItem("GP_FORM8_REFNO");
  if(!refNo){
    refNo = genRefNo();
    localStorage.setItem("GP_FORM8_REFNO", refNo);
  }

  // ✅ applicant link (from main form)
  const raw = localStorage.getItem("GP_APPLICANT");
  const applicant = raw ? JSON.parse(raw) : {};
  const regNo = applicant.regNo || localStorage.getItem("GP_REGNO_TODAY") || "";

  // ✅ local file save (download)
  const localPayload = {
    refNo,
    applicationNo: regNo,
    savedAt: new Date().toISOString(),
    formData
  };

  downloadJson(`${refNo}.json`, localPayload);

  // ✅ MongoDB save (houseTax)
  try{
    const mongoPayload = {
      refNo,
      applicationNo: regNo,
      applicantName: applicant.name || "",
      mobile: applicant.mobile || "",
      aadhaar: applicant.aadhaar || "",
      address: applicant.address || "",
      savedAtISO: new Date().toISOString(),
      formData
    };

    const r = await saveForm8ToMongoOnce(refNo, mongoPayload);

    if (r && r.success){
      alert("✅ Saved (JSON downloaded + MongoDB saved)!\nDB ID: " + r.id);
    } else if (r && r.skipped){
      alert("✅ Saved JSON!\n(Mongo already saved for this Form8 refNo)");
    } else {
      alert("✅ Saved JSON!\n⚠️ Mongo save failed (check server).");
      console.log("Mongo save failed:", r);
    }
  }catch(err){
    alert("✅ Saved JSON!\n⚠️ Mongo error (check server).");
    console.log("Mongo error:", err.message);
  }
});
