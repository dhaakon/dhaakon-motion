//! Pure numeric sampling shared by native and Wasm. No clock, renderer or host callbacks.
//! Successful warm sampling does not allocate and writes one retained f64 output buffer.

use motion_ir::{Direction, Error, Plan};

enum Curve {
    Linear,
    InQuad,
    OutQuad,
    InOutQuad,
    InCubic,
    OutCubic,
    InOutCubic,
    InQuart,
    OutQuart,
    InOutQuart,
    OutBack,
    Bezier([f64; 4]),
    Spring {
        omega: f64,
        ratio: f64,
        damped: f64,
        end: f64,
    },
    Steps {
        count: f64,
        start: bool,
    },
}

fn spring_response(t: f64, omega: f64, ratio: f64, damped: f64) -> f64 {
    if ratio < 1.0 {
        1.0 - (-ratio * omega * t).exp()
            * ((damped * t).cos() + (ratio * omega / damped) * (damped * t).sin())
    } else {
        1.0 - (-omega * t).exp() * (1.0 + omega * t)
    }
}

impl Curve {
    fn compile(easing: motion_ir::Easing) -> Self {
        match easing.kind.as_str() {
            "linear" => Self::Linear,
            "easeInQuad" => Self::InQuad,
            "easeOutQuad" => Self::OutQuad,
            "easeInOutQuad" => Self::InOutQuad,
            "easeInCubic" => Self::InCubic,
            "easeOutCubic" => Self::OutCubic,
            "easeInOutCubic" => Self::InOutCubic,
            "easeInQuart" => Self::InQuart,
            "easeOutQuart" => Self::OutQuart,
            "easeInOutQuart" => Self::InOutQuart,
            "easeOutBack" => Self::OutBack,
            "dhaakon" => Self::Bezier([0.16, 1.0, 0.3, 1.0]),
            "cubicBezier" => Self::Bezier([
                easing.args[0],
                easing.args[1],
                easing.args[2],
                easing.args[3],
            ]),
            "steps" => Self::Steps {
                count: easing.args[0],
                start: easing.args[1] == 1.0,
            },
            "spring" => {
                let stiffness = easing.args[0];
                let damping = easing.args[1];
                let mass = easing.args[2];
                let omega = (stiffness / mass).sqrt();
                let ratio = damping / (2.0 * (stiffness * mass).sqrt());
                let damped = if ratio < 1.0 {
                    omega * (1.0 - ratio * ratio).sqrt()
                } else {
                    0.0
                };
                let end = spring_response(1.0, omega, ratio, damped);
                Self::Spring {
                    omega,
                    ratio,
                    damped,
                    end: if end == 0.0 { 1.0 } else { end },
                }
            }
            _ => unreachable!("only validated easing descriptors are compiled"),
        }
    }

    fn sample(&self, t: f64) -> f64 {
        match *self {
            Self::Linear => t,
            Self::InQuad => t * t,
            Self::OutQuad => t * (2.0 - t),
            Self::InOutQuad => {
                if t < 0.5 {
                    2.0 * t * t
                } else {
                    1.0 - (-2.0 * t + 2.0).powi(2) / 2.0
                }
            }
            Self::InCubic => t.powi(3),
            Self::OutCubic => 1.0 - (1.0 - t).powi(3),
            Self::InOutCubic => {
                if t < 0.5 {
                    4.0 * t.powi(3)
                } else {
                    1.0 - (-2.0 * t + 2.0).powi(3) / 2.0
                }
            }
            Self::InQuart => t.powi(4),
            Self::OutQuart => 1.0 - (1.0 - t).powi(4),
            Self::InOutQuart => {
                if t < 0.5 {
                    8.0 * t.powi(4)
                } else {
                    1.0 - (-2.0 * t + 2.0).powi(4) / 2.0
                }
            }
            Self::OutBack => 1.0 + 2.70158 * (t - 1.0).powi(3) + 1.70158 * (t - 1.0).powi(2),
            Self::Bezier([x1, y1, x2, y2]) => {
                let sample = |a: f64, b: f64, value: f64| {
                    3.0 * a * (1.0 - value).powi(2) * value
                        + 3.0 * b * (1.0 - value) * value.powi(2)
                        + value.powi(3)
                };
                let mut low = 0.0;
                let mut high = 1.0;
                let mut value = t;
                for _ in 0..12 {
                    let estimate = sample(x1, x2, value);
                    if (estimate - t).abs() < 0.0001 {
                        break;
                    }
                    if estimate < t {
                        low = value;
                    } else {
                        high = value;
                    }
                    value = (low + high) / 2.0;
                }
                sample(y1, y2, value)
            }
            Self::Spring {
                omega,
                ratio,
                damped,
                end,
            } => spring_response(t, omega, ratio, damped) / end,
            Self::Steps { count, start } => {
                let value = t * count;
                (if start { value.ceil() } else { value.floor() } / count).clamp(0.0, 1.0)
            }
        }
    }
}

struct CompiledTrack {
    times: Vec<f64>,
    values: Vec<f64>,
    curves: Vec<Curve>,
    width: usize,
    repeat: i32,
    repeat_delay: f64,
    direction: Direction,
    output_offset: usize,
}

impl CompiledTrack {
    fn local_time(&self, ms: f64) -> f64 {
        let duration = self.times[self.times.len() - 1];
        if duration == 0.0 {
            return 0.0;
        }
        let active = ms.max(0.0);
        let cycle = duration + self.repeat_delay;
        let (local, odd) = if self.repeat == -1 {
            // Remainders avoid an infinite quotient for valid subnormal durations.
            (
                (active % cycle).min(duration),
                ((active % (2.0 * cycle)) / cycle).floor() == 1.0,
            )
        } else {
            let iteration = (active / cycle).floor().min(f64::from(self.repeat));
            (
                (active - iteration * cycle).clamp(0.0, duration),
                iteration % 2.0 == 1.0,
            )
        };
        let alternate = matches!(
            self.direction,
            Direction::Alternate | Direction::AlternateReverse
        );
        let reverse = matches!(
            self.direction,
            Direction::Reverse | Direction::AlternateReverse
        );
        // Keep Track.sampleAt's progress→duration evaluation order for parity.
        let progress = local / duration;
        (if reverse ^ (alternate && odd) {
            1.0 - progress
        } else {
            progress
        })
        .clamp(0.0, 1.0)
            * duration
    }

    fn sample_into(&self, ms: f64, output: &mut [f64]) {
        let time = self.local_time(ms);
        let last = self.times.len() - 1;
        let endpoint = if last == 0 || time <= self.times[0] {
            Some(0)
        } else if time >= self.times[last] {
            Some(last)
        } else {
            None
        };
        if let Some(key) = endpoint {
            output.copy_from_slice(&self.values[key * self.width..(key + 1) * self.width]);
            return;
        }
        // Lower bound preserves first-ending-segment behavior at duplicate keys.
        let to = self.times.partition_point(|&at| at < time);
        let from = to - 1;
        let span = self.times[to] - self.times[from];
        let progress = if span <= 0.0 {
            1.0
        } else {
            (time - self.times[from]) / span
        };
        let eased = self.curves[from].sample(progress.clamp(0.0, 1.0));
        for (channel, value) in output.iter_mut().enumerate() {
            let start = self.values[from * self.width + channel];
            let end = self.values[to * self.width + channel];
            *value = start + (end - start) * eased;
        }
    }
}

pub struct NumericPlan {
    tracks: Vec<CompiledTrack>,
    output: Vec<f64>,
    key_scalars: usize,
}

impl NumericPlan {
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, Error> {
        Self::compile(Plan::from_bytes(bytes)?)
    }

    pub fn from_json(json: &str) -> Result<Self, Error> {
        Self::compile(Plan::from_json(json)?)
    }

    pub fn compile(plan: Plan) -> Result<Self, Error> {
        let shape = plan.validate()?;
        let mut offset = 0;
        let tracks = plan
            .tracks
            .into_iter()
            .map(|track| {
                let width = track.values[0].len();
                let compiled = CompiledTrack {
                    times: track.times,
                    values: track.values.into_iter().flatten().collect(),
                    curves: track.easings.into_iter().map(Curve::compile).collect(),
                    width,
                    repeat: track.repeat,
                    repeat_delay: track.repeat_delay,
                    direction: track.direction,
                    output_offset: offset,
                };
                offset += width;
                compiled
            })
            .collect();
        let mut compiled = Self {
            tracks,
            output: vec![0.0; shape.output_scalars],
            key_scalars: shape.key_scalars,
        };
        compiled.sample(0.0)?;
        Ok(compiled)
    }

    pub fn sample(&mut self, milliseconds: f64) -> Result<(), Error> {
        if !milliseconds.is_finite() || milliseconds.abs() > 1e15 {
            return Err(Error::new(
                "INVALID_TIME",
                "sample time must be finite milliseconds with magnitude <=1e15",
            ));
        }
        for track in &self.tracks {
            track.sample_into(
                milliseconds,
                &mut self.output[track.output_offset..track.output_offset + track.width],
            );
        }
        Ok(())
    }

    /// Borrowed until the next sample or plan destruction. Wasm hosts also track memory growth.
    pub fn values(&self) -> &[f64] {
        &self.output
    }
    pub fn key_scalars(&self) -> usize {
        self.key_scalars
    }
}
