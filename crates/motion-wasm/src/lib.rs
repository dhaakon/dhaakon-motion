//! Narrow ABI. Handles and borrowed views belong to exactly one Wasm instance.
//! No host callback occurs while the arena is borrowed; stale handles never recycle.

#![cfg(any(target_arch = "wasm32", test))]

use motion_core::NumericPlan;
use motion_ir::Error;

const MAX_LIVE_PLANS: usize = 256;
const MAX_RETAINED_KEYS: usize = 8_000_000;
const MAX_RETAINED_OUTPUT: usize = 2_000_000;
const MAX_SLOTS: usize = u16::MAX as usize;

struct Slot {
    generation: u16,
    plan: Option<NumericPlan>,
}
#[derive(Default)]
struct Arena {
    slots: Vec<Slot>,
    live: usize,
    keys: usize,
    output: usize,
}

impl Arena {
    fn insert(&mut self, plan: NumericPlan) -> Result<u32, Error> {
        if self.live >= MAX_LIVE_PLANS
            || self.keys + plan.key_scalars() > MAX_RETAINED_KEYS
            || self.output + plan.values().len() > MAX_RETAINED_OUTPUT
        {
            return Err(Error::new(
                "RESOURCE_LIMIT",
                "Wasm instance retained-plan budget exceeded",
            ));
        }
        let index = if let Some(index) = self
            .slots
            .iter()
            .position(|slot| slot.plan.is_none() && slot.generation != 0)
        {
            index
        } else {
            if self.slots.len() >= MAX_SLOTS {
                return Err(Error::new(
                    "RESOURCE_LIMIT",
                    "Wasm instance handle generations exhausted",
                ));
            }
            self.slots.push(Slot {
                generation: 1,
                plan: None,
            });
            self.slots.len() - 1
        };
        self.live += 1;
        self.keys += plan.key_scalars();
        self.output += plan.values().len();
        self.slots[index].plan = Some(plan);
        Ok((u32::from(self.slots[index].generation) << 16) | (index as u32 + 1))
    }

    fn index(&self, handle: u32) -> Result<usize, Error> {
        let encoded = (handle & 0xffff) as usize;
        let generation = (handle >> 16) as u16;
        if encoded > 0 && generation > 0 {
            let index = encoded - 1;
            if let Some(slot) = self.slots.get(index)
                && slot.generation == generation
                && slot.plan.is_some()
            {
                return Ok(index);
            }
        }
        Err(Error::new(
            "STALE_HANDLE",
            "invalid or freed plan handle for this instance",
        ))
    }

    fn get(&self, handle: u32) -> Result<&NumericPlan, Error> {
        Ok(self.slots[self.index(handle)?]
            .plan
            .as_ref()
            .expect("index validated"))
    }
    fn get_mut(&mut self, handle: u32) -> Result<&mut NumericPlan, Error> {
        let index = self.index(handle)?;
        Ok(self.slots[index].plan.as_mut().expect("index validated"))
    }
    fn free(&mut self, handle: u32) -> Result<(), Error> {
        let index = self.index(handle)?;
        let slot = &mut self.slots[index];
        let plan = slot.plan.take().expect("index validated");
        self.live -= 1;
        self.keys -= plan.key_scalars();
        self.output -= plan.values().len();
        // Retire exhausted slots permanently: wrapping would resurrect old handles.
        slot.generation = slot.generation.checked_add(1).unwrap_or(0);
        Ok(())
    }
}

#[cfg(target_arch = "wasm32")]
mod abi {
    use super::*;
    use std::cell::RefCell;
    use wasm_bindgen::prelude::*;

    thread_local! { static ARENA: RefCell<Arena> = RefCell::new(Arena::default()); }
    fn js_error(error: Error) -> JsValue {
        JsValue::from_str(&error.to_string())
    }
    fn with_arena<T>(operation: impl FnOnce(&mut Arena) -> Result<T, Error>) -> Result<T, JsValue> {
        ARENA.with(|arena| {
            let mut arena = arena
                .try_borrow_mut()
                .map_err(|_| JsValue::from_str("REENTRANT_CALL: plan arena is already borrowed"))?;
            operation(&mut arena).map_err(js_error)
        })
    }

    #[wasm_bindgen]
    pub fn version() -> u32 {
        motion_ir::VERSION
    }
    /// The WebAssembly.Memory for this module instance, usable by web and Node glue.
    #[wasm_bindgen]
    pub fn wasm_memory() -> JsValue {
        wasm_bindgen::memory()
    }
    #[wasm_bindgen]
    pub fn create(plan_json: &str) -> Result<u32, JsValue> {
        let plan = NumericPlan::from_json(plan_json).map_err(js_error)?;
        with_arena(|arena| arena.insert(plan))
    }
    /// Additive binary-v1 creation. Uses the same validation, arena and sampling ABI.
    #[wasm_bindgen]
    pub fn create_binary(bytes: &[u8]) -> Result<u32, JsValue> {
        let plan = NumericPlan::from_bytes(bytes).map_err(js_error)?;
        with_arena(|arena| arena.insert(plan))
    }
    #[wasm_bindgen]
    pub fn sample(handle: u32, milliseconds: f64) -> Result<(), JsValue> {
        with_arena(|arena| arena.get_mut(handle)?.sample(milliseconds))
    }
    /// Byte offset into this instance's exported memory; refresh after memory growth.
    #[wasm_bindgen]
    pub fn values_ptr(handle: u32) -> Result<u32, JsValue> {
        with_arena(|arena| Ok(arena.get(handle)?.values().as_ptr() as u32))
    }
    /// Number of f64 values, not bytes. Reading after free is outside the contract.
    #[wasm_bindgen]
    pub fn values_len(handle: u32) -> Result<u32, JsValue> {
        with_arena(|arena| Ok(arena.get(handle)?.values().len() as u32))
    }
    #[wasm_bindgen]
    pub fn free(handle: u32) -> Result<(), JsValue> {
        with_arena(|arena| arena.free(handle))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn empty() -> NumericPlan {
        NumericPlan::from_json(r#"{"version":1,"tracks":[]}"#).unwrap()
    }

    #[test]
    fn handles_reject_freed_invalid_and_reused_generations() {
        let mut arena = Arena::default();
        let old = arena.insert(empty()).unwrap();
        assert!(arena.get(old).is_ok());
        arena.free(old).unwrap();
        assert!(arena.free(old).is_err());
        assert!(arena.get_mut(old).is_err());
        let new = arena.insert(empty()).unwrap();
        assert_ne!(new, old);
        assert!(arena.get(old).is_err());
        assert!(arena.get(new).is_ok());
        for invalid in [0, 1, u32::MAX, 65536] {
            assert!(arena.get(invalid).is_err());
        }
    }

    #[test]
    fn generations_retire_instead_of_wrapping() {
        let mut arena = Arena::default();
        arena.insert(empty()).unwrap();
        arena.slots[0].generation = u16::MAX;
        arena.free((u32::from(u16::MAX) << 16) | 1).unwrap();
        let handle = arena.insert(empty()).unwrap();
        assert_eq!(handle & 0xffff, 2);
        assert_eq!(arena.slots[0].generation, 0);
    }

    #[test]
    fn arena_resource_failure_does_not_damage_existing_plans() {
        let mut arena = Arena::default();
        let first = arena.insert(empty()).unwrap();
        for _ in 1..MAX_LIVE_PLANS {
            arena.insert(empty()).unwrap();
        }
        assert!(arena.insert(empty()).is_err());
        assert!(arena.get(first).is_ok());
        arena.free(first).unwrap();
        assert!(arena.insert(empty()).is_ok());
    }
}
