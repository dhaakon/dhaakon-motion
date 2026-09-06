//! Independent native conformance runner; bounded JSON input/output, not a video export CLI.
use motion_core::NumericPlan;
use motion_ir::{MAX_JSON_BYTES, Plan, VERSION};
use serde::{Deserialize, Serialize};
use std::io::{self, Read};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Input {
    plan: Plan,
    times: Vec<f64>,
}
#[derive(Serialize)]
struct Output {
    version: u32,
    frames: Vec<Vec<f64>>,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut json = String::new();
    io::stdin()
        .take((MAX_JSON_BYTES + 1) as u64)
        .read_to_string(&mut json)?;
    if json.len() > MAX_JSON_BYTES {
        return Err("runner input exceeds 64 MiB".into());
    }
    let input: Input = serde_json::from_str(&json)?;
    if input.times.len() > 100_000 {
        return Err("runner accepts at most 100000 samples".into());
    }
    let mut plan = NumericPlan::compile(input.plan)?;
    if input.times.len().saturating_mul(plan.values().len()) > 4_000_000 {
        return Err("runner output exceeds 4000000 numeric values".into());
    }
    let mut output = Output {
        version: VERSION,
        frames: Vec::with_capacity(input.times.len()),
    };
    for time in input.times {
        plan.sample(time)?;
        output.frames.push(plan.values().to_vec());
    }
    serde_json::to_writer(io::stdout().lock(), &output)?;
    Ok(())
}
