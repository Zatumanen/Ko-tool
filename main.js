class WorkerPool {
  constructor(url, size) {
    this.workers = Array.from({ length: size }, () => new Worker(url));
    this.busy = new Set();
    this.queue = [];
  }
  async exec(payload) {
    let w = this.workers.find((x) => !this.busy.has(x));
    if (!w) {
      return new Promise((r) => this.queue.push({ payload, r })).then(() =>
        this.exec(payload)
      );
    }
    return new Promise((resolve, reject) => {
      const id = Math.random();
      const fn = ({ data }) => {
        if (data.id !== id) return;
        w.removeEventListener("message", fn);
        this.busy.delete(w);
        if (this.queue.length) {
          const { payload: p, r } = this.queue.shift();
          r(this.exec(p));
        }
        data.err ? reject(new Error(data.err)) : resolve(data);
      };
      w.addEventListener("message", fn);
      this.busy.add(w);
      w.postMessage({ id, payload });
    });
  }
}

const pool = new WorkerPool("./worker.js", navigator.hardwareConcurrency || 4);

const app = document.getElementById("app");
app.innerHTML = `
  <div class="window">
    <div class="title-bar">
      <span>SpeedUpperCut</span>
      <div>
        <button class="min" title="Свернуть">_</button>
        <button class="close" title="Закрыть">×</button>
      </div>
    </div>
    <div class="content">
      <div class="drop-zone" id="dz">Перетащите аудио или нажмите для выбора</div>
      <input id="file" type="file" multiple accept="audio/*" style="display:none"/>
      <div id="file-info"></div>
      <div class="progress-bar-container" id="pb" style="display:none;"></div>
    </div>
  </div>
`;

const dz = document.getElementById("dz");
const fileInput = document.getElementById("file");
const info = document.getElementById("file-info");
const pb = document.getElementById("pb");

dz.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", handleFiles);
["dragover", "dragleave", "drop"].forEach((ev) =>
  dz.addEventListener(ev, (e) => {
    e.preventDefault();
    dz.classList.toggle("dragover", ev === "dragover");
    if (ev === "drop")
      handleFiles({ target: { files: e.dataTransfer.files } });
  })
);

async function handleFiles({ target }) {
  const files = [...target.files];
  if (!files.length) return;
  pb.style.display = "flex";
  info.textContent = "Обработка...";
  pb.innerHTML = Array(50)
    .fill(0)
    .map(() => `<div class="progress-segment"></div>`)
    .join("");

  const JSZip = await import(
    "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
  );
  const zip = new JSZip.default();
  const results = await Promise.all(
    files.map((f, i) =>
      pool
        .exec({ file: f, fidelity: "cd", channels: "stereo", trim: true })
        .then((r) => {
          updateProgress((i + 1) / files.length);
          return r;
        })
    )
  );

  results.forEach(({ res }) => zip.file(res.name, res.blob));
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ko2_processed.zip";
  a.click();
  URL.revokeObjectURL(url);
  pb.style.display = "none";
  info.textContent = "Готово!";
}

function updateProgress(p) {
  const segs = pb.querySelectorAll(".progress-segment");
  const n = Math.floor(p * segs.length);
  segs.forEach((s, i) => s.classList.toggle("active", i < n));
}
