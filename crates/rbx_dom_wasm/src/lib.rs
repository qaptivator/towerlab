mod codec;
mod json_value;

use serde::Serialize;
use wasm_bindgen::prelude::*;

pub use codec::{parse_bytes, serialize_rbxl_bytes, serialize_rbxm_bytes, RbxDocument, RbxNode};

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(start)]
fn start() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen(js_name = parseRobloxFile)]
pub fn parse_roblox_file(bytes: &[u8]) -> Result<JsValue, JsValue> {
    let document = parse_bytes(bytes).map_err(|error| JsValue::from_str(&error))?;
    // Property bags are maps. The default serializer turns those into ES Map
    // objects, which JSON.stringify and Object.entries both treat as empty.
    document
        .serialize(&serde_wasm_bindgen::Serializer::json_compatible())
        .map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen(js_name = serializeRbxm)]
pub fn serialize_rbxm(document: JsValue) -> Result<Vec<u8>, JsValue> {
    let document: RbxDocument = serde_wasm_bindgen::from_value(document)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    serialize_rbxm_bytes(&document).map_err(|error| JsValue::from_str(&error))
}

#[wasm_bindgen(js_name = serializeRbxl)]
pub fn serialize_rbxl(document: JsValue) -> Result<Vec<u8>, JsValue> {
    let document: RbxDocument = serde_wasm_bindgen::from_value(document)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    serialize_rbxl_bytes(&document).map_err(|error| JsValue::from_str(&error))
}
