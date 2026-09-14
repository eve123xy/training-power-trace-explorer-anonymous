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

const trainingSpecs = [
  ["anonymous-training-h100-001", "Anonymous-7B", "full fine-tuning", "NVIDIA H100", 4, 2380, 2925, 396.7, 600, 4096, 2, 8],
  ["anonymous-training-h100-002", "Anonymous-13B", "LoRA fine-tuning", "NVIDIA H100", 8, 4210, 5180, 842.0, 720, 8192, 1, 16],
  ["anonymous-training-a100-003", "Anonymous-7B", "full fine-tuning", "NVIDIA A100", 4, 1715, 2190, 343.0, 720, 4096, 4, 4],
  ["anonymous-training-a100-004", "Anonymous-34B", "FSDP pretraining", "NVIDIA A100", 8, 3350, 4085, 893.3, 960, 2048, 1, 32],
  ["anonymous-training-h100-005", "Anonymous-70B", "tensor-parallel SFT", "NVIDIA H100", 8, 4860, 6035, 972.0, 720, 8192, 1, 16],
  ["anonymous-training-l40s-006", "Anonymous-3B", "adapter tuning", "NVIDIA L40S", 2, 670, 910, 111.7, 600, 4096, 8, 2],
  ["anonymous-training-h100-007", "Anonymous-MoE", "expert-parallel pretraining", "NVIDIA H100", 16, 9280, 11140, 2474.7, 960, 4096, 1, 64],
  ["anonymous-training-a100-008", "Anonymous-13B", "continued pretraining", "NVIDIA A100", 8, 3480, 4360, 696.0, 720, 4096, 2, 16],
] as const;

const inferenceSpecs = [
  ["anonymous-inference-h100-009", "Anonymous-70B", "serving", "NVIDIA H100", 4, 2140, 2785, 285.3, 480, 4, "fp8", "bf16", 32, "bursty", 11.5],
  ["anonymous-inference-a100-010", "Anonymous-13B", "serving", "NVIDIA A100", 2, 920, 1215, 122.7, 480, 2, "fp16", "int8", 48, "poisson", 18.0],
  ["anonymous-inference-h100-011", "Anonymous-34B", "batch serving", "NVIDIA H100", 4, 1870, 2440, 249.3, 480, 4, "fp8", "fp8", 64, "ramp", 24.0],
  ["anonymous-inference-l40s-012", "Anonymous-7B", "edge serving", "NVIDIA L40S", 1, 305, 430, 40.7, 480, 1, "fp16", "int4", 16, "steady", 6.0],
] as const;

const DEMO_CATALOG: PublicRun[] = [
  ...trainingSpecs.map(([run_id, model, method, gpu_type, gpu_count, mean_total_power_w, p99_total_power_w, total_energy_wh, duration_observed_s, sequence_length, microbatch_size, grad_accum_steps], idx) => ({
    ...baseRun,
    run_id,
    workload_type: "Training" as const,
    model,
    method,
    gpu_type,
    gpu_count,
    mean_total_power_w,
    p95_total_power_w: Math.round(Number(p99_total_power_w) * 0.96),
    p99_total_power_w,
    max_total_power_w: Math.round(Number(p99_total_power_w) * 1.03),
    total_energy_wh,
    mean_power_per_gpu_w: Math.round(Number(mean_total_power_w) / Number(gpu_count)),
    duration_observed_s,
    sequence_length,
    microbatch_size,
    grad_accum_steps,
    global_batch_size: Number(gpu_count) * Number(microbatch_size) * Number(grad_accum_steps),
    run_json_file_id: `local-training-${idx + 1}`,
    raw_csv_file_id: `local-training-csv-${idx + 1}`,
    metadata_json_file_id: `local-training-meta-${idx + 1}`,
  })),
  ...inferenceSpecs.map(([run_id, model, method, gpu_type, gpu_count, mean_total_power_w, p99_total_power_w, total_energy_wh, duration_observed_s, tensor_parallel_size, kv_cache_quantization, model_weight_quantization, in_flight_requests, arrival_pattern, arrival_rate_rps], idx) => ({
    ...baseRun,
    run_id,
    workload_type: "Inference" as const,
    model,
    method,
    gpu_type,
    gpu_count,
    mean_total_power_w,
    p95_total_power_w: Math.round(Number(p99_total_power_w) * 0.95),
    p99_total_power_w,
    max_total_power_w: Math.round(Number(p99_total_power_w) * 1.03),
    total_energy_wh,
    mean_power_per_gpu_w: Math.round(Number(mean_total_power_w) / Number(gpu_count)),
    duration_observed_s,
    tensor_parallel_size,
    kv_cache_quantization,
    model_weight_quantization,
    gpu_frequency_mhz: gpu_type === "NVIDIA L40S" ? 1800 : 1410,
    in_flight_requests,
    concurrency: in_flight_requests,
    arrival_pattern,
    arrival_rate_rps,
    arrival_rate_label: `${arrival_rate_rps} req/s`,
    inference_engine: "anonymous serving stack",
    prompt_profile: "mixed prompt lengths",
    run_json_file_id: `local-inference-${idx + 1}`,
    raw_csv_file_id: `local-inference-csv-${idx + 1}`,
    metadata_json_file_id: `local-inference-meta-${idx + 1}`,
    request_timeline_file_id: `local-inference-timeline-${idx + 1}`,
  })),
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
