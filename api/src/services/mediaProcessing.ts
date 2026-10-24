import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { Media, MediaDoc } from "../models/Media";

type Probe = ffmpeg.FfprobeData;

export function probe(file: string): Promise<Probe> {
  return new Promise((resolve, reject) => ffmpeg.ffprobe(file, (err, data) => (err ? reject(err) : resolve(data))));
}

function fps(rate?: string) {
  if (!rate) return 0;
  const [a, b] = rate.split("/").map(Number);
  return b ? a / b : a;
}

export type Plan = { convert: boolean; error?: string; reasons: string[] };

const IMAGE_MIN_RATIO = 4 / 5;
const IMAGE_MAX_RATIO = 1.91;

export function planImage(p: Probe, sizeBytes: number): Plan {
  const v = p.streams.find((s) => s.codec_type === "video");
  if (!v) return { convert: false, error: "Imagem sem conteúdo legível.", reasons: [] };
  const reasons: string[] = [];
  if (v.codec_name !== "mjpeg") reasons.push("formato não é JPEG");
  if (sizeBytes > 8 * 1024 * 1024) reasons.push("maior que 8 MB");
  const w = v.width ?? 0;
  const h = v.height ?? 0;
  if (w > 1440) reasons.push("largura acima de 1440 px");
  const ratio = h ? w / h : 1;
  if (ratio < IMAGE_MIN_RATIO - 0.005 || ratio > IMAGE_MAX_RATIO + 0.005) reasons.push("proporção fora de 4:5 a 1,91:1");
  return { convert: reasons.length > 0, reasons };
}

export function planVideo(p: Probe, sizeBytes: number): Plan {
  const v = p.streams.find((s) => s.codec_type === "video");
  const a = p.streams.find((s) => s.codec_type === "audio");
  if (!v) return { convert: false, error: "Vídeo sem faixa de imagem.", reasons: [] };
  const duration = Number(p.format.duration ?? 0);
  if (duration && duration < 3) return { convert: false, error: "O vídeo precisa ter pelo menos 3 segundos.", reasons: [] };
  if (duration > 15 * 60) return { convert: false, error: "O vídeo passa de 15 minutos.", reasons: [] };
  const reasons: string[] = [];
  const container = String(p.format.format_name ?? "");
  if (!/mp4|mov/.test(container)) reasons.push("contêiner não é MP4 ou MOV");
  if (!["h264", "hevc"].includes(String(v.codec_name))) reasons.push("vídeo não é H.264 ou HEVC");
  if (v.pix_fmt && v.pix_fmt !== "yuv420p") reasons.push("cor fora de yuv420p");
  if (a && a.codec_name !== "aac") reasons.push("áudio não é AAC");
  if (fps(v.avg_frame_rate) > 60) reasons.push("mais de 60 quadros por segundo");
  if ((v.width ?? 0) > 1920) reasons.push("largura acima de 1920 px");
  if (sizeBytes > 300 * 1024 * 1024) reasons.push("maior que 300 MB");
  return { convert: reasons.length > 0, reasons };
}

function run(cmd: ffmpeg.FfmpegCommand, out: string) {
  return new Promise<void>((resolve, reject) => {
    cmd.on("end", () => resolve()).on("error", (err) => reject(err)).save(out);
  });
}

export async function convertImage(input: string, output: string, p: Probe) {
  const v = p.streams.find((s) => s.codec_type === "video")!;
  const w = v.width ?? 1080;
  const h = v.height ?? 1080;
  const ratio = w / h;
  const filters = ["scale='min(1440,iw)':-2"];
  if (ratio < IMAGE_MIN_RATIO) filters.push("pad=ceil(ih*4/5/2)*2:ih:(ow-iw)/2:0:white");
  if (ratio > IMAGE_MAX_RATIO) filters.push("pad=iw:ceil(iw/1.91/2)*2:0:(oh-ih)/2:white");
  await run(ffmpeg(input).videoFilters(filters).outputOptions(["-frames:v 1", "-q:v 3"]).format("image2"), output);
}

export async function convertVideo(input: string, output: string, p: Probe) {
  const v = p.streams.find((s) => s.codec_type === "video")!;
  const a = p.streams.find((s) => s.codec_type === "audio");
  const frameRate = Math.min(fps(v.avg_frame_rate) || 30, 60);
  const cmd = ffmpeg(input)
    .videoCodec("libx264")
    .videoFilters(["scale='min(1920,iw)':-2"])
    .outputOptions(["-preset veryfast", "-crf 23", "-pix_fmt yuv420p", `-r ${frameRate}`, "-movflags +faststart", "-maxrate 25M", "-bufsize 50M"])
    .format("mp4");
  if (a) cmd.audioCodec("aac").audioBitrate("128k").audioFrequency(48000).audioChannels(2);
  else cmd.noAudio();
  await run(cmd, output);
}

function applyProbe(m: MediaDoc, p: Probe) {
  const v = p.streams.find((s) => s.codec_type === "video");
  m.width = v?.width;
  m.height = v?.height;
  const d = Number(p.format.duration);
  m.durationSec = m.kind === "video" && Number.isFinite(d) ? Math.round(d * 10) / 10 : undefined;
}

export async function processMedia(mediaId: string) {
  const m = await Media.findById(mediaId);
  if (!m || m.deletedAt || !["pending", "converting"].includes(m.conversionStatus)) return;
  try {
    const p = await probe(m.storagePath);
    applyProbe(m, p);
    const plan = m.kind === "image" ? planImage(p, m.sizeBytes) : planVideo(p, m.sizeBytes);
    if (plan.error) {
      m.conversionStatus = "failed";
      m.conversionError = plan.error;
      await m.save();
      return;
    }
    if (!plan.convert) {
      m.conversionStatus = "not_needed";
      await m.save();
      return;
    }
    m.conversionStatus = "converting";
    await m.save();
    const ext = m.kind === "image" ? ".jpg" : ".mp4";
    const out = path.join(path.dirname(m.storagePath), `${path.basename(m.storagePath, path.extname(m.storagePath))}-ig${ext}`);
    if (m.kind === "image") await convertImage(m.storagePath, out, p);
    else await convertVideo(m.storagePath, out, p);
    const converted = await probe(out);
    const old = m.storagePath;
    m.storagePath = out;
    m.mimeType = m.kind === "image" ? "image/jpeg" : "video/mp4";
    m.sizeBytes = fs.statSync(out).size;
    applyProbe(m, converted);
    m.conversionStatus = "done";
    m.conversionError = undefined;
    await m.save();
    await fs.promises.rm(old, { force: true });
  } catch (err) {
    m.conversionStatus = "failed";
    m.conversionError = "Não foi possível ler ou converter o arquivo.";
    await m.save().catch(() => {});
    console.error("falha ao processar mídia", mediaId, (err as Error).message);
  }
}

let chain: Promise<void> = Promise.resolve();

export function enqueueMedia(mediaId: string) {
  const next = chain.then(() => processMedia(mediaId));
  chain = next.catch(() => {});
  return next;
}

export function mediaQueueIdle() {
  return chain;
}

export async function resumePendingMedia() {
  const items = await Media.find({ conversionStatus: { $in: ["pending", "converting"] }, deletedAt: { $exists: false } }, { _id: 1 });
  for (const m of items) {
    await Media.updateOne({ _id: m._id }, { conversionStatus: "pending" });
    enqueueMedia(m.id);
  }
}

export async function removeMediaFile(m: MediaDoc) {
  await fs.promises.rm(m.storagePath, { force: true });
}
