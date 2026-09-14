import type { Run, Sample } from "../app/lib/types";

export type PublicRun = Run & {
  run_json_file_id: string;
  raw_csv_file_id: string;
  metadata_json_file_id: string;
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

type DriveConfiguration = {
  apiKey: string;
  catalogFileId: string;
};

function driveConfiguration(): DriveConfiguration | null {
  const apiKey = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY?.trim();
  const catalogFileId = import.meta.env.VITE_GOOGLE_DRIVE_CATALOG_FILE_ID?.trim();
  if (!apiKey || !catalogFileId) return null;
  return { apiKey, catalogFileId };
}

function googleDriveContentUrl(fileId: string) {
  const cfg = driveConfiguration();
  if (!cfg) return "#";
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set("alt", "media");
  url.searchParams.set("key", cfg.apiKey);
  return url.toString();
}

async function loadJson<T>(fileId: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(googleDriveContentUrl(fileId), { signal });
  if (!response.ok) throw new Error(`Google Drive data request failed (${response.status})`);
  return response.json() as Promise<T>;
}

const baseRun = {
  source_family: "Synthetic showcase",
  source_directory: "anonymous-demo",
  trace_path: "synthetic_power_trace.csv",
  stdout_path: null,
  stderr_path: null,
  plot_path: null,
  meta_path: null,
  model_family: "LLM",
  model_source_label: "Anonymous artifact demo",
  model_metadata_status: "reported" as const,
  gpu_type: "NVIDIA H100",
  gpu_count: 4,
  precision: "bf16",
  compute_dtype: "bf16",
  quantization_bits: "none",
  parallelism: "tensor+data",
  sequence_length: 4096,
  microbatch_size: 2,
  grad_accum_steps: 8,
  global_batch_size: 64,
  checkpoint_interval: 500,
  dataset_name: "Synthetic public showcase",
  duration_declared_min: 10,
  duration_observed_s: 600,
  sampling_interval_declared_s: 1,
  sampling_interval_observed_median_s: 1,
  sampling_interval_observed_p95_s: 1.08,
  has_stage_labels: true,
  has_clock_telemetry: true,
  has_utilization_telemetry: true,
  has_temperature_telemetry: true,
  quality_status: "DEMO_SYNTHETIC",
  mean_total_power_w: 2380,
  p95_total_power_w: 2860,
  p99_total_power_w: 2925,
  max_total_power_w: 3010,
  total_energy_wh: 396.7,
  mean_power_per_gpu_w: 595,
  ramp_up_p95_1s_w_per_s: 240,
  ramp_up_p99_1s_w_per_s: 310,
  ramp_down_p99_1s_w_per_s: -285,
  ramp_event_frequency_1s: 0.08,
  num_samples: 604,
  num_gpus_observed: 4,
  logging_method: "synthetic",
  power_aggregation: "sum_over_gpus",
  quality_flags: [{ code: "DEMO", severity: "info" as const, message: "Synthetic illustrative data bundled for anonymous review." }],
  missing_fields: [],
  timestamp_issues: [],
  gpu_count_mismatch: false,
  duplicate_warning: false,
};

const DEMO_CATALOG: PublicRun[] = [
  {
    ...baseRun,
    run_id: "anonymous-training-demo",
    workload_type: "Training",
    model: "Anonymous-7B",
    method: "full fine-tuning",
    run_json_file_id: "local-training-demo",
    raw_csv_file_id: "local-training-csv",
    metadata_json_file_id: "local-training-meta",
  },
  {
    ...baseRun,
    run_id: "anonymous-inference-demo",
    workload_type: "Inference",
    model: "Anonymous-70B",
    method: "serving",
    duration_observed_s: 480,
    mean_total_power_w: 2140,
    p95_total_power_w: 2640,
    p99_total_power_w: 2785,
    max_total_power_w: 2860,
    total_energy_wh: 285.3,
    tensor_parallel_size: 4,
    kv_cache_quantization: "fp8",
    model_weight_quantization: "bf16",
    gpu_frequency_mhz: 1410,
    in_flight_requests: 32,
    concurrency: 32,
    arrival_pattern: "bursty",
    arrival_rate_rps: 11.5,
    arrival_rate_label: "11.5 req/s",
    inference_engine: "anonymous serving stack",
    prompt_profile: "mixed prompt lengths",
    run_json_file_id: "local-inference-demo",
    raw_csv_file_id: "local-inference-csv",
    metadata_json_file_id: "local-inference-meta",
    request_timeline_file_id: "local-inference-timeline",
  },
];

function demoSamples(run: PublicRun): Sample[] {
  const rows: Sample[] = [];
  const duration = Math.round(Number(run.duration_observed_s) || 600);
  const gpus = Number(run.gpu_count) || 4;
  for (let t = 0; t <= duration; t += 4) {
    const phase = t / Math.max(duration, 1);
    const envelope = run.workload_type === "Inference"
      ? 0.48 + 0.42 * Math.exp(-Math.pow((phase - 0.48) / 0.24, 2)) + 0.08 * Math.sin(t / 13)
      : 0.45 + 0.38 * Math.sin(Math.min(1, phase) * Math.PI) + 0.06 * Math.sin(t / 17);
    for (let gpu = 0; gpu < gpus; gpu += 1) {
      const power = Math.max(120, Math.round(Number(run.mean_power_per_gpu_w) * envelope + 18 * Math.sin(t / 9 + gpu)));
      rows.push({
        timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, t)).toISOString(),
        time_relative_s: t,
        gpu_id: String(gpu),
        power_w: power,
        sm_clock_mhz: 1410,
        gpu_util_pct: Math.min(99, Math.round(38 + envelope * 58)),
        memory_util_pct: Math.min(95, Math.round(42 + envelope * 36)),
        memory_used_mb: Math.round(42000 + envelope * 26000),
        memory_total_mb: 81920,
        temperature_c: Math.round(48 + envelope * 28),
        stage: phase < 0.12 ? "warmup" : phase > 0.88 ? "cooldown" : "steady_state",
      });
    }
  }
  return rows;
}

function demoDetail(run: PublicRun): PublicRunDetail {
  return { run, samples: demoSamples(run) };
}

export const loadCatalog = (signal?: AbortSignal) => {
  const cfg = driveConfiguration();
  return cfg ? loadJson<PublicRun[]>(cfg.catalogFileId, signal) : Promise.resolve(DEMO_CATALOG);
};

export const loadRun = (run: PublicRun, signal?: AbortSignal) => {
  const cfg = driveConfiguration();
  return cfg ? loadJson<PublicRunDetail>(run.run_json_file_id, signal) : Promise.resolve(demoDetail(run));
};

export const publicArtifactUrl = (fileId: string) => googleDriveContentUrl(fileId);
