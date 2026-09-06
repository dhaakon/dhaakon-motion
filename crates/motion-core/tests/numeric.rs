use motion_core::NumericPlan;
use motion_ir::{Direction, Easing, Plan, Track, VERSION};

fn track(times: &[f64], values: &[f64], direction: Direction, repeat: i32, delay: f64) -> Track {
    Track {
        id: "fixture".into(),
        times: times.to_vec(),
        values: values.iter().map(|&v| vec![v]).collect(),
        easings: (1..times.len())
            .map(|_| Easing {
                kind: "linear".into(),
                args: vec![],
            })
            .collect(),
        repeat,
        repeat_delay: delay,
        direction,
    }
}
fn compile(track: Track) -> NumericPlan {
    NumericPlan::compile(Plan {
        version: VERSION,
        tracks: vec![track],
    })
    .unwrap()
}
fn sample(plan: &mut NumericPlan, time: f64) -> f64 {
    plan.sample(time).unwrap();
    plan.values()[0]
}
fn close(actual: f64, expected: f64) {
    assert!(
        (actual - expected).abs() <= 1e-9 * expected.abs().max(1.0),
        "{actual} != {expected}"
    );
}

#[test]
fn scalar_random_access_and_retained_buffer() {
    let mut p = compile(track(
        &[0.0, 100.0],
        &[0.0, 10.0],
        Direction::Normal,
        0,
        0.0,
    ));
    let pointer = p.values().as_ptr();
    for (time, expected) in [
        (200.0, 10.0),
        (-5.0, 0.0),
        (50.0, 5.0),
        (25.0, 2.5),
        (100.0, 10.0),
    ] {
        close(sample(&mut p, time), expected);
        assert_eq!(p.values().as_ptr(), pointer);
    }
}

#[test]
fn concatenates_vector_tracks_in_authored_order() {
    let mut first = track(&[0.0, 100.0], &[0.0, 10.0], Direction::Normal, 0, 0.0);
    first.values = vec![vec![0.0, 20.0], vec![10.0, 40.0]];
    let mut second = track(&[0.0, 100.0], &[100.0, 200.0], Direction::Normal, 0, 0.0);
    second.id = "second".into();
    let mut p = NumericPlan::compile(Plan {
        version: VERSION,
        tracks: vec![first, second],
    })
    .unwrap();
    p.sample(50.0).unwrap();
    assert_eq!(p.values(), &[5.0, 30.0, 150.0]);
}

#[test]
fn repeat_delay_half_open_edges_and_all_directions() {
    for (direction, expected) in [
        (Direction::Normal, [0.0, 10.0, 0.0, 5.0, 10.0]),
        (Direction::Reverse, [10.0, 0.0, 10.0, 5.0, 0.0]),
        (Direction::Alternate, [0.0, 10.0, 10.0, 5.0, 0.0]),
        (Direction::AlternateReverse, [10.0, 0.0, 0.0, 5.0, 10.0]),
    ] {
        let mut p = compile(track(&[0.0, 100.0], &[0.0, 10.0], direction, 1, 20.0));
        for (time, value) in [0.0, 110.0, 120.0, 170.0, 1000.0].into_iter().zip(expected) {
            close(sample(&mut p, time), value);
        }
    }
}

#[test]
fn submillisecond_and_infinite_cycles_remain_finite() {
    let mut p = compile(track(&[0.0, 0.25], &[0.0, 1.0], Direction::Normal, 3, 0.0));
    close(sample(&mut p, 0.375), 0.5);
    let mut p = compile(track(
        &[0.0, 0.25],
        &[0.0, 1.0],
        Direction::Alternate,
        -1,
        0.0,
    ));
    close(sample(&mut p, 0.3125), 0.75);
    close(sample(&mut p, 0.5), 0.0);
    let mut p = compile(track(
        &[0.0, f64::from_bits(1)],
        &[0.0, 1.0],
        Direction::Alternate,
        -1,
        0.0,
    ));
    assert!(sample(&mut p, 1e15).is_finite());
}

#[test]
fn zero_duration_single_key_and_duplicate_key_contracts() {
    for repeat in [-1, 0, 1, 2] {
        let mut p = compile(track(
            &[0.0, 0.0],
            &[5.0, 10.0],
            Direction::AlternateReverse,
            repeat,
            0.0,
        ));
        assert_eq!(sample(&mut p, 100.0), 5.0);
    }
    let mut p = compile(track(
        &[0.0, 5.0, 5.0, 10.0],
        &[0.0, 10.0, 20.0, 30.0],
        Direction::Normal,
        0,
        0.0,
    ));
    close(sample(&mut p, 5.0), 10.0);
    close(sample(&mut p, 7.5), 25.0);
    let mut p = compile(track(&[100.0], &[42.0], Direction::Reverse, -1, 20.0));
    close(sample(&mut p, -100.0), 42.0);
    close(sample(&mut p, 999.0), 42.0);
}

#[test]
fn rejects_invalid_sample_without_changing_output() {
    let mut p = compile(track(&[0.0, 100.0], &[0.0, 1.0], Direction::Normal, 0, 0.0));
    p.sample(25.0).unwrap();
    for time in [
        f64::NAN,
        f64::INFINITY,
        f64::NEG_INFINITY,
        1e15 + 1.0,
        -1e15 - 1.0,
    ] {
        assert!(p.sample(time).is_err());
        assert_eq!(p.values(), &[0.25]);
    }
    assert!(p.sample(1e15).is_ok());
    assert!(p.sample(-1e15).is_ok());
}

#[test]
fn builtins_and_parameterized_easings_have_known_samples() {
    for (kind, args, expected) in [
        ("linear", vec![], 0.25),
        ("easeInQuad", vec![], 0.0625),
        ("easeOutQuad", vec![], 0.4375),
        ("easeInOutQuad", vec![], 0.125),
        ("easeInCubic", vec![], 0.015625),
        ("easeOutCubic", vec![], 0.578125),
        ("easeInOutCubic", vec![], 0.0625),
        ("easeInQuart", vec![], 0.00390625),
        ("easeOutQuart", vec![], 0.68359375),
        ("easeInOutQuart", vec![], 0.03125),
        ("easeOutBack", vec![], 0.8174096875000002),
        ("steps", vec![3.0, 0.0], 0.0),
        ("steps", vec![3.0, 1.0], 1.0 / 3.0),
        ("cubicBezier", vec![0.0, 0.0, 1.0, 1.0], 0.2500041658372538),
        ("dhaakon", vec![], 0.8256465404263054),
        ("spring", vec![170.0, 26.0, 1.0], 0.8377453226552745),
    ] {
        let mut t = track(&[0.0, 100.0], &[0.0, 1.0], Direction::Normal, 0, 0.0);
        t.easings[0] = Easing {
            kind: kind.into(),
            args,
        };
        let mut p = compile(t);
        close(sample(&mut p, 25.0), expected);
    }
}

#[test]
fn bounded_springs_are_finite_across_parameter_extremes() {
    for args in [
        vec![170.0, 26.0, 1.0],
        vec![1e-6, 0.0, 1e6],
        vec![1e6, 1e6, 1e-6],
        vec![1e-6, 1e6, 1e6],
    ] {
        let mut t = track(&[0.0, 100.0], &[-1e100, 1e100], Direction::Normal, 0, 0.0);
        t.easings[0] = Easing {
            kind: "spring".into(),
            args,
        };
        let mut p = compile(t);
        for time in [0.0, 1.0, 25.0, 50.0, 99.0, 100.0] {
            assert!(sample(&mut p, time).is_finite());
        }
    }
}

#[test]
fn empty_plan_has_an_empty_output() {
    let mut p = NumericPlan::compile(Plan {
        version: VERSION,
        tracks: vec![],
    })
    .unwrap();
    p.sample(42.0).unwrap();
    assert!(p.values().is_empty());
}

#[test]
fn binary_and_json_creation_sample_identically() {
    let descriptor = Plan {
        version: VERSION,
        tracks: vec![track(
            &[0.0, 0.25],
            &[-2.0, 8.0],
            Direction::AlternateReverse,
            -1,
            0.125,
        )],
    };
    let mut json = NumericPlan::from_json(&serde_json::to_string(&descriptor).unwrap()).unwrap();
    let mut bytes = b"DHM1".to_vec();
    bytes.extend(VERSION.to_le_bytes());
    bytes.extend(1u32.to_le_bytes());
    bytes.extend(7u32.to_le_bytes());
    bytes.extend(b"fixture");
    bytes.extend(1u32.to_le_bytes());
    bytes.extend(2u32.to_le_bytes());
    bytes.extend((-1i32).to_le_bytes());
    bytes.extend(0.125f64.to_le_bytes());
    bytes.push(3);
    for value in [0.0f64, 0.25, -2.0, 8.0] {
        bytes.extend(value.to_le_bytes());
    }
    bytes.extend([0, 0]); // linear, no arguments
    let mut binary = NumericPlan::from_bytes(&bytes).unwrap();
    for time in [-1.0, 0.0, 0.0625, 0.25, 0.375, 0.4375, 1e15, 0.125] {
        json.sample(time).unwrap();
        binary.sample(time).unwrap();
        assert_eq!(json.values(), binary.values());
    }
}
