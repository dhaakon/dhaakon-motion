//! Bounded, alignment-independent DHM1 reader. No unchecked casts or allocations
//! based solely on untrusted lengths. Sampling never sees this creation format.

use super::*;

pub(crate) const EASING_KINDS: [&str; 15] = [
    "linear",
    "easeInQuad",
    "easeOutQuad",
    "easeInOutQuad",
    "easeInCubic",
    "easeOutCubic",
    "easeInOutCubic",
    "easeInQuart",
    "easeOutQuart",
    "easeInOutQuart",
    "easeOutBack",
    "dhaakon",
    "cubicBezier",
    "spring",
    "steps",
];

struct Reader<'a> {
    bytes: &'a [u8],
    position: usize,
}
impl<'a> Reader<'a> {
    fn error(&self, message: &str) -> Error {
        Error::new(
            "INVALID_BINARY",
            format!("byte {}: {message}", self.position),
        )
    }
    fn require(&self, count: usize) -> Result<(), Error> {
        if count > self.bytes.len() - self.position {
            Err(self.error("truncated numeric descriptor"))
        } else {
            Ok(())
        }
    }
    fn take(&mut self, count: usize) -> Result<&'a [u8], Error> {
        self.require(count)?;
        let start = self.position;
        self.position += count; // require() proves this addition stays within bytes.len().
        Ok(&self.bytes[start..self.position])
    }
    fn u8(&mut self) -> Result<u8, Error> {
        Ok(self.take(1)?[0])
    }
    fn u32(&mut self) -> Result<u32, Error> {
        Ok(u32::from_le_bytes(
            self.take(4)?.try_into().expect("four checked bytes"),
        ))
    }
    fn i32(&mut self) -> Result<i32, Error> {
        Ok(i32::from_le_bytes(
            self.take(4)?.try_into().expect("four checked bytes"),
        ))
    }
    fn f64(&mut self) -> Result<f64, Error> {
        Ok(f64::from_le_bytes(
            self.take(8)?.try_into().expect("eight checked bytes"),
        ))
    }
}

fn checked_sum(left: usize, right: usize) -> Result<usize, Error> {
    left.checked_add(right)
        .ok_or_else(|| Error::new("RESOURCE_LIMIT", "binary size overflow"))
}
fn checked_product(left: usize, right: usize) -> Result<usize, Error> {
    left.checked_mul(right)
        .ok_or_else(|| Error::new("RESOURCE_LIMIT", "binary size overflow"))
}

pub(crate) fn decode(bytes: &[u8]) -> Result<Plan, Error> {
    if bytes.len() > MAX_BINARY_BYTES {
        return Err(Error::new(
            "RESOURCE_LIMIT",
            "binary descriptor exceeds 64 MiB",
        ));
    }
    let mut reader = Reader { bytes, position: 0 };
    if reader.take(4)? != b"DHM1" {
        return Err(reader.error("expected DHM1 magic"));
    }
    if reader.u32()? != VERSION {
        return Err(Error::new(
            "VERSION_MISMATCH",
            "numeric binary version must be 1",
        ));
    }
    let count = reader.u32()? as usize;
    if count > MAX_TRACKS {
        return Err(Error::new("RESOURCE_LIMIT", "too many binary tracks"));
    }
    // Each smallest valid track needs an ID byte, fixed headers, one time and value.
    // Reject count-only / undersized payloads before reserving track or ID storage.
    reader.require(checked_product(count, 42)?)?;
    let mut tracks = Vec::with_capacity(count);
    let mut ids = HashSet::with_capacity(count);
    let mut key_scalars = 0;
    let mut output_scalars = 0;

    for _ in 0..count {
        let id_len = reader.u32()? as usize;
        if id_len == 0 || id_len > MAX_ID_BYTES {
            return Err(reader.error("ID length must be 1..256 UTF-8 bytes"));
        }
        let id = std::str::from_utf8(reader.take(id_len)?)
            .map_err(|_| reader.error("ID is not valid UTF-8"))?;
        if !ids.insert(id) {
            return Err(reader.error("duplicate track ID"));
        }
        let width = reader.u32()? as usize;
        let keys = reader.u32()? as usize;
        if width == 0 || width > MAX_WIDTH || keys == 0 || keys > MAX_KEYS {
            return Err(reader.error("expected width 1..64 and keys 1..4096"));
        }
        let scalars = checked_product(keys, width)?;
        key_scalars = checked_sum(key_scalars, scalars)?;
        output_scalars = checked_sum(output_scalars, width)?;
        if key_scalars > MAX_KEY_SCALARS || output_scalars > MAX_OUTPUT_SCALARS {
            return Err(Error::new(
                "RESOURCE_LIMIT",
                "binary plan exceeds numeric channel budget",
            ));
        }
        let repeat = reader.i32()?;
        let repeat_delay = reader.f64()?;
        if !(-1..=MAX_REPEAT).contains(&repeat) || !bounded(repeat_delay, 0.0, MAX_TIME) {
            return Err(reader.error("invalid repeat or repeatDelay"));
        }
        let direction = match reader.u8()? {
            0 => Direction::Normal,
            1 => Direction::Reverse,
            2 => Direction::Alternate,
            3 => Direction::AlternateReverse,
            _ => return Err(reader.error("unknown direction code")),
        };
        let numeric_bytes = checked_product(checked_sum(keys, scalars)?, 8)?;
        let easing_headers = checked_product(keys - 1, 2)?;
        reader.require(checked_sum(numeric_bytes, easing_headers)?)?;
        let mut times = Vec::with_capacity(keys);
        for _ in 0..keys {
            let time = reader.f64()?;
            if !bounded(time, 0.0, MAX_TIME)
                || times.last().is_some_and(|&previous| previous > time)
            {
                return Err(
                    reader.error("times must be finite, nondecreasing and in 0..1e12 milliseconds")
                );
            }
            times.push(time);
        }
        let mut values = Vec::with_capacity(keys);
        for _ in 0..keys {
            let mut value = Vec::with_capacity(width);
            for _ in 0..width {
                let number = reader.f64()?;
                if !bounded(number, -MAX_VALUE, MAX_VALUE) {
                    return Err(reader.error("invalid numeric value"));
                }
                value.push(number);
            }
            values.push(value);
        }
        let mut easings = Vec::with_capacity(keys - 1);
        for _ in 1..keys {
            let code = reader.u8()? as usize;
            let arg_count = reader.u8()? as usize;
            let kind = EASING_KINDS
                .get(code)
                .ok_or_else(|| reader.error("unknown easing code"))?;
            let expected = match code {
                12 => 4,
                13 => 3,
                14 => 2,
                _ => 0,
            };
            if arg_count != expected {
                return Err(reader.error("easing argument count does not match kind"));
            }
            reader.require(checked_product(arg_count, 8)?)?;
            let mut args = Vec::with_capacity(arg_count);
            for _ in 0..arg_count {
                args.push(reader.f64()?);
            }
            let easing = Easing {
                kind: (*kind).into(),
                args,
            };
            easing.validate()?;
            easings.push(easing);
        }
        tracks.push(Track {
            id: id.into(),
            times,
            values,
            easings,
            repeat,
            repeat_delay,
            direction,
        });
    }
    if reader.position != bytes.len() {
        return Err(reader.error("trailing bytes after numeric descriptor"));
    }
    // Share the semantic contract with JSON and directly constructed native plans.
    let plan = Plan {
        version: VERSION,
        tracks,
    };
    plan.validate()?;
    Ok(plan)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> Plan {
        Plan {
            version: VERSION,
            tracks: vec![Track {
                id: "x".into(),
                times: vec![0.0, 5.0, 5.0, 10.0],
                values: vec![
                    vec![0.0, -2.0],
                    vec![5.0, 2.0],
                    vec![7.0, 3.0],
                    vec![10.0, 20.0],
                ],
                easings: vec![
                    Easing {
                        kind: "linear".into(),
                        args: vec![],
                    },
                    Easing {
                        kind: "steps".into(),
                        args: vec![4.0, 1.0],
                    },
                    Easing {
                        kind: "spring".into(),
                        args: vec![170.0, 26.0, 1.0],
                    },
                ],
                repeat: -1,
                repeat_delay: 0.25,
                direction: Direction::AlternateReverse,
            }],
        }
    }

    fn encode(plan: &Plan) -> Vec<u8> {
        let mut bytes = b"DHM1".to_vec();
        bytes.extend(plan.version.to_le_bytes());
        bytes.extend((plan.tracks.len() as u32).to_le_bytes());
        for track in &plan.tracks {
            bytes.extend((track.id.len() as u32).to_le_bytes());
            bytes.extend(track.id.as_bytes());
            bytes.extend((track.values[0].len() as u32).to_le_bytes());
            bytes.extend((track.times.len() as u32).to_le_bytes());
            bytes.extend(track.repeat.to_le_bytes());
            bytes.extend(track.repeat_delay.to_le_bytes());
            bytes.push(match track.direction {
                Direction::Normal => 0,
                Direction::Reverse => 1,
                Direction::Alternate => 2,
                Direction::AlternateReverse => 3,
            });
            for value in &track.times {
                bytes.extend(value.to_le_bytes());
            }
            for row in &track.values {
                for value in row {
                    bytes.extend(value.to_le_bytes());
                }
            }
            for curve in &track.easings {
                bytes.push(
                    EASING_KINDS
                        .iter()
                        .position(|kind| *kind == curve.kind)
                        .unwrap() as u8,
                );
                bytes.push(curve.args.len() as u8);
                for arg in &curve.args {
                    bytes.extend(arg.to_le_bytes());
                }
            }
        }
        bytes
    }

    #[test]
    fn binary_roundtrip_matches_json_for_all_codes_and_directions() {
        let mut plan = fixture();
        for (index, kind) in EASING_KINDS.into_iter().enumerate() {
            let args = match kind {
                "cubicBezier" => vec![0.16, 1.0, 0.3, 1.0],
                "spring" => vec![170.0, 26.0, 1.0],
                "steps" => vec![4.0, 1.0],
                _ => vec![],
            };
            let mut track = plan.tracks[0].clone();
            track.id = format!("曲線-{index}");
            track.direction = [
                Direction::Normal,
                Direction::Reverse,
                Direction::Alternate,
                Direction::AlternateReverse,
            ][index % 4];
            track.easings = vec![
                Easing {
                    kind: kind.into(),
                    args
                };
                3
            ];
            plan.tracks.push(track);
        }
        let decoded = Plan::from_bytes(&encode(&plan)).unwrap();
        assert_eq!(
            serde_json::to_value(decoded).unwrap(),
            serde_json::to_value(plan).unwrap()
        );
        let empty = Plan {
            version: VERSION,
            tracks: vec![],
        };
        assert!(Plan::from_bytes(&encode(&empty)).unwrap().tracks.is_empty());
    }

    #[test]
    fn every_truncated_prefix_and_trailing_byte_is_rejected() {
        let bytes = encode(&fixture());
        for length in 0..bytes.len() {
            assert!(
                Plan::from_bytes(&bytes[..length]).is_err(),
                "accepted prefix {length}"
            );
        }
        let mut trailing = bytes;
        trailing.push(0);
        assert!(Plan::from_bytes(&trailing).is_err());
    }

    #[test]
    fn malformed_headers_counts_codes_and_utf8_are_rejected() {
        let bytes = encode(&fixture());
        for (offset, replacement) in [
            (0, b"BAD!".as_slice()),
            (4, &2u32.to_le_bytes()),
            (8, &u32::MAX.to_le_bytes()),
            (12, &u32::MAX.to_le_bytes()),
            (16, &[255]),
            (17, &u32::MAX.to_le_bytes()),
            (21, &u32::MAX.to_le_bytes()),
            (25, &(-2i32).to_le_bytes()),
            (29, &f64::NAN.to_le_bytes()),
            (37, &[4]),
            (134, &[255]),
            (135, &[255]),
        ] {
            let mut corrupt = bytes.clone();
            corrupt[offset..offset + replacement.len()].copy_from_slice(replacement);
            assert!(
                Plan::from_bytes(&corrupt).is_err(),
                "accepted corruption at {offset}"
            );
        }
        let mut duplicate = fixture();
        duplicate.tracks.push(duplicate.tracks[0].clone());
        assert!(Plan::from_bytes(&encode(&duplicate)).is_err());
        let mut no_payload = b"DHM1".to_vec();
        no_payload.extend(VERSION.to_le_bytes());
        no_payload.extend((MAX_TRACKS as u32).to_le_bytes());
        assert!(Plan::from_bytes(&no_payload).is_err());
        assert!(Plan::from_bytes(&vec![0; MAX_BINARY_BYTES + 1]).is_err());
    }

    #[test]
    fn numeric_semantics_and_unaligned_input_are_validated() {
        let bytes = encode(&fixture());
        let mut padded = vec![0];
        padded.extend(&bytes);
        assert!(Plan::from_bytes(&padded[1..]).is_ok());
        for time in [f64::NAN, f64::INFINITY, -1.0, MAX_TIME + 1.0] {
            let mut invalid = fixture();
            invalid.tracks[0].times[1] = time;
            assert!(Plan::from_bytes(&encode(&invalid)).is_err());
        }
        for number in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY, MAX_VALUE * 2.0] {
            let mut invalid = fixture();
            invalid.tracks[0].values[0][0] = number;
            assert!(Plan::from_bytes(&encode(&invalid)).is_err());
        }
        let mut unsorted = fixture();
        unsorted.tracks[0].times[1] = 6.0;
        assert!(Plan::from_bytes(&encode(&unsorted)).is_err());
    }

    #[test]
    fn checked_length_arithmetic_cannot_wrap() {
        assert!(checked_sum(usize::MAX, 1).is_err());
        assert!(checked_product(usize::MAX, 2).is_err());
    }
}
