//! Version-one portable numeric tracks. This is not the authored cue-sheet or scene schema.
//! All validation is performed before a plan can become a sampling resource.

use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fmt};

mod binary;

pub const VERSION: u32 = 1;
pub const MAX_JSON_BYTES: usize = 64 * 1024 * 1024;
pub const MAX_BINARY_BYTES: usize = 64 * 1024 * 1024;
pub const MAX_TRACKS: usize = 100_000;
pub const MAX_KEYS: usize = 4_096;
pub const MAX_WIDTH: usize = 64;
pub const MAX_KEY_SCALARS: usize = 4_000_000;
pub const MAX_OUTPUT_SCALARS: usize = 1_000_000;
pub const MAX_ID_BYTES: usize = 256;
pub const MAX_TIME: f64 = 1e12;
pub const MAX_VALUE: f64 = 1e100;
pub const MAX_REPEAT: i32 = 1_000_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Error {
    pub code: &'static str,
    pub message: String,
}

impl Error {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}
impl std::error::Error for Error {}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum Direction {
    Normal,
    Reverse,
    Alternate,
    AlternateReverse,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Easing {
    pub kind: String,
    pub args: Vec<f64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub times: Vec<f64>,
    pub values: Vec<Vec<f64>>,
    /// One descriptor per segment, associated with its ending key.
    pub easings: Vec<Easing>,
    /// -1 means infinite. Nonnegative values count additional iterations.
    pub repeat: i32,
    pub repeat_delay: f64,
    pub direction: Direction,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Plan {
    pub version: u32,
    pub tracks: Vec<Track>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Shape {
    pub key_scalars: usize,
    pub output_scalars: usize,
}

fn bounded(value: f64, minimum: f64, maximum: f64) -> bool {
    value.is_finite() && value >= minimum && value <= maximum
}

impl Easing {
    pub fn validate(&self) -> Result<(), Error> {
        let args = self.args.as_slice();
        let valid = match self.kind.as_str() {
            "linear" | "easeInQuad" | "easeOutQuad" | "easeInOutQuad" | "easeInCubic"
            | "easeOutCubic" | "easeInOutCubic" | "easeInQuart" | "easeOutQuart"
            | "easeInOutQuart" | "easeOutBack" | "dhaakon" => args.is_empty(),
            "cubicBezier" => matches!(args, [x1, y1, x2, y2]
                if bounded(*x1, 0.0, 1.0) && bounded(*x2, 0.0, 1.0)
                && bounded(*y1, -100.0, 100.0) && bounded(*y2, -100.0, 100.0)),
            "spring" => matches!(args, [stiffness, damping, mass]
                if bounded(*stiffness, 1e-6, 1e6) && bounded(*damping, 0.0, 1e6)
                && bounded(*mass, 1e-6, 1e6)),
            "steps" => matches!(args, [count, position]
                if bounded(*count, 1.0, 1e6) && count.fract() == 0.0
                && (*position == 0.0 || *position == 1.0)),
            _ => false,
        };
        if valid {
            Ok(())
        } else {
            Err(Error::new(
                "INVALID_EASING",
                format!("unsupported kind or arguments: {}", self.kind),
            ))
        }
    }
}

impl Plan {
    /// Decode a bounded little-endian DHM1 descriptor, not an authored cue sheet.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, Error> {
        binary::decode(bytes)
    }

    pub fn from_json(json: &str) -> Result<Self, Error> {
        if json.len() > MAX_JSON_BYTES {
            return Err(Error::new("RESOURCE_LIMIT", "plan JSON exceeds 64 MiB"));
        }
        let plan: Self = serde_json::from_str(json)
            .map_err(|error| Error::new("INVALID_JSON", error.to_string()))?;
        plan.validate()?;
        Ok(plan)
    }

    pub fn validate(&self) -> Result<Shape, Error> {
        if self.version != VERSION {
            return Err(Error::new(
                "VERSION_MISMATCH",
                "numeric IR version must be 1",
            ));
        }
        if self.tracks.len() > MAX_TRACKS {
            return Err(Error::new("RESOURCE_LIMIT", "too many tracks"));
        }
        let mut ids = HashSet::with_capacity(self.tracks.len());
        let mut shape = Shape {
            key_scalars: 0,
            output_scalars: 0,
        };
        for (index, track) in self.tracks.iter().enumerate() {
            let fail =
                |message: &str| Error::new("INVALID_TRACK", format!("tracks[{index}]: {message}"));
            if track.id.is_empty()
                || track.id.len() > MAX_ID_BYTES
                || !ids.insert(track.id.as_str())
            {
                return Err(fail("id must be unique and contain 1..256 UTF-8 bytes"));
            }
            if track.times.is_empty() || track.times.len() > MAX_KEYS {
                return Err(fail("expected 1..4096 keys"));
            }
            if track.times.len() != track.values.len()
                || track.easings.len() != track.times.len() - 1
            {
                return Err(fail("key/value/segment lengths do not match"));
            }
            if !track.times.iter().all(|&time| bounded(time, 0.0, MAX_TIME))
                || track.times.windows(2).any(|pair| pair[0] > pair[1])
            {
                return Err(fail(
                    "times must be finite, nondecreasing and in 0..1e12 milliseconds",
                ));
            }
            let width = track.values[0].len();
            if width == 0 || width > MAX_WIDTH {
                return Err(fail("vector width must be 1..64"));
            }
            if track.values.iter().any(|value| {
                value.len() != width
                    || value
                        .iter()
                        .any(|&number| !bounded(number, -MAX_VALUE, MAX_VALUE))
            }) {
                return Err(fail(
                    "vectors must have equal widths and finite values with magnitude <=1e100",
                ));
            }
            if !(-1..=MAX_REPEAT).contains(&track.repeat)
                || !bounded(track.repeat_delay, 0.0, MAX_TIME)
            {
                return Err(fail("invalid repeat or repeatDelay"));
            }
            for (segment, easing) in track.easings.iter().enumerate() {
                easing
                    .validate()
                    .map_err(|error| fail(&format!("easings[{segment}]: {error}")))?;
            }
            shape.key_scalars += width * track.times.len();
            shape.output_scalars += width;
            if shape.key_scalars > MAX_KEY_SCALARS || shape.output_scalars > MAX_OUTPUT_SCALARS {
                return Err(Error::new(
                    "RESOURCE_LIMIT",
                    "plan exceeds numeric channel budget",
                ));
            }
        }
        Ok(shape)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn plan() -> Plan {
        Plan {
            version: VERSION,
            tracks: vec![Track {
                id: "x".into(),
                times: vec![0.0, 1.0],
                values: vec![vec![0.0], vec![1.0]],
                easings: vec![Easing {
                    kind: "linear".into(),
                    args: vec![],
                }],
                repeat: 0,
                repeat_delay: 0.0,
                direction: Direction::Normal,
            }],
        }
    }

    #[test]
    fn rejects_nonfinite_values_and_times() {
        for value in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY, 1e101] {
            let mut p = plan();
            p.tracks[0].values[0][0] = value;
            assert!(p.validate().is_err());
        }
        for time in [f64::NAN, f64::INFINITY, -1.0, MAX_TIME + 1.0] {
            let mut p = plan();
            p.tracks[0].times[1] = time;
            assert!(p.validate().is_err());
        }
    }

    #[test]
    fn validates_shapes_sorting_duplicates_and_unique_ids() {
        let mut p = plan();
        p.tracks[0].times[1] = 0.0;
        assert!(p.validate().is_ok());
        p.tracks[0].times = vec![1.0, 0.0];
        assert!(p.validate().is_err());
        let mut p = plan();
        p.tracks[0].values[1].push(2.0);
        assert!(p.validate().is_err());
        let mut p = plan();
        p.tracks[0].easings.clear();
        assert!(p.validate().is_err());
        let mut p = plan();
        p.tracks.push(p.tracks[0].clone());
        assert!(p.validate().is_err());
        let mut p = plan();
        p.tracks[0].id = "é".repeat(129);
        assert!(p.validate().is_err());
    }

    #[test]
    fn rejects_versions_unknown_fields_and_oversized_inputs() {
        assert!(Plan::from_json(r#"{"version":2,"tracks":[]}"#).is_err());
        assert!(Plan::from_json(r#"{"version":1,"tracks":[],"unexpected":true}"#).is_err());
        assert!(Plan::from_json(&" ".repeat(MAX_JSON_BYTES + 1)).is_err());
        let mut p = plan();
        p.tracks[0].times = vec![0.0; MAX_KEYS + 1];
        assert!(p.validate().is_err());
        let mut p = plan();
        p.tracks[0].values[0] = vec![0.0; MAX_WIDTH + 1];
        assert!(p.validate().is_err());
        let mut p = plan();
        p.tracks[0].repeat = MAX_REPEAT + 1;
        assert!(p.validate().is_err());
    }

    #[test]
    fn rejects_unbounded_or_unknown_easing_parameters() {
        for (kind, args) in [
            ("__proto__", vec![]),
            ("linear", vec![1.0]),
            ("spring", vec![0.0, 26.0, 1.0]),
            ("steps", vec![1.5, 0.0]),
            ("steps", vec![2.0, 2.0]),
            ("cubicBezier", vec![-1.0, 0.0, 1.0, 1.0]),
        ] {
            assert!(
                Easing {
                    kind: kind.into(),
                    args
                }
                .validate()
                .is_err()
            );
        }
    }

    #[test]
    fn enforces_aggregate_key_and_output_budgets() {
        let make = |count: usize, keys: usize| Plan {
            version: VERSION,
            tracks: (0..count)
                .map(|index| Track {
                    id: index.to_string(),
                    times: vec![0.0; keys],
                    values: vec![vec![0.0; MAX_WIDTH]; keys],
                    easings: vec![
                        Easing {
                            kind: "linear".into(),
                            args: vec![]
                        };
                        keys - 1
                    ],
                    repeat: 0,
                    repeat_delay: 0.0,
                    direction: Direction::Normal,
                })
                .collect(),
        };
        let keys = make(MAX_KEY_SCALARS / (MAX_WIDTH * 64) + 1, 64);
        assert_eq!(keys.validate().unwrap_err().code, "RESOURCE_LIMIT");
        drop(keys);
        let output = make(MAX_OUTPUT_SCALARS / MAX_WIDTH + 1, 1);
        assert_eq!(output.validate().unwrap_err().code, "RESOURCE_LIMIT");
    }
}
