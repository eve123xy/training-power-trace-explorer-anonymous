import type { Run, Sample } from "../app/lib/types";

/**
 * Anonymous review build: every public record is bundled with the site as a
 * static, gzip-compressed JSON file under `data/`. No third-party storage is
 * contacted at runtime.
 */
export type PublicRun = Run & {
  /** Local key of the bundled run payload (`data/runs/<key>.json.gz`). */
  run_json_file_id: string;
  raw_csv_file_id?: string | null;
  metadata_json_file_id?: string | null;
  request_timeline_file_id?: string | null;
};

export type InferenceRequestTimelinePoint = {
  time_relative_s: number | string;
  window_s?: number | string | null;
  requests_arrived?: number | string | null;
  active_requests?: number | string | null;
  mean_prompt_tokens?: number | string | null;
  mean_output_tokens?: number | string | null;
  mean_request_tokens?: number | string | null;
};

export type PublicRunDetail = {
  run: PublicRun;
  samples: Sample[];
  inference_timeline?: InferenceRequestTimelinePoint[];
};

const DATA_BASE = `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}data/`;

async function fetchOk(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok || !response.body) throw new Error(`Public data request failed (${response.status})`);
  return response;
}

async function loadGzipJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetchOk(url, signal);
  // Some hosts label .gz files with Content-Encoding and the browser inflates
  // them transparently; GitHub Pages serves the raw bytes. Detect by magic number.
  const bytes = new Uint8Array(await response.arrayBuffer());
  const isGzip = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!isGzip) return JSON.parse(new TextDecoder().decode(bytes)) as T;
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot decompress bundled data; please use a current Chrome, Firefox, or Safari.");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).json() as Promise<T>;
}

export const loadCatalog = async (signal?: AbortSignal): Promise<PublicRun[]> => {
  const response = await fetchOk(`${DATA_BASE}catalog.json`, signal);
  return response.json() as Promise<PublicRun[]>;
};

export const loadRun = (run: PublicRun, signal?: AbortSignal) =>
  loadGzipJson<PublicRunDetail>(`${DATA_BASE}runs/${encodeURIComponent(run.run_json_file_id)}.json.gz`, signal);

const SAMPLE_COLUMNS: (keyof Sample)[] = ["timestamp", "time_relative_s", "gpu_id", "power_w", "total_power_w", "gpu_util_pct", "memory_util_pct", "memory_used_mb", "memory_total_mb", "sm_clock_mhz", "temperature_c", "stage"];
const TIMELINE_COLUMNS: (keyof InferenceRequestTimelinePoint)[] = ["time_relative_s", "window_s", "requests_arrived", "active_requests", "mean_prompt_tokens", "mean_output_tokens", "mean_request_tokens"];

function csvCell(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function toCsv<T extends object>(rows: T[], columns: (keyof T)[]) {
  const used = columns.filter((column) => rows.some((row) => row[column] != null));
  const header = used.join(",");
  const body = rows.map((row) => used.map((column) => csvCell(row[column])).join(","));
  return [header, ...body].join("\n") + "\n";
}

/** CSV export of the canonical normalized samples, generated in the browser. */
export const samplesCsv = (detail: PublicRunDetail) => toCsv(detail.samples, SAMPLE_COLUMNS);

/** CSV export of the time-binned inference request timeline, generated in the browser. */
export const requestTimelineCsv = (detail: PublicRunDetail) => (detail.inference_timeline?.length ? toCsv(detail.inference_timeline, TIMELINE_COLUMNS) : null);
