use std::collections::{BTreeMap, HashMap};
use std::str::FromStr;

use rbx_dom_weak::{InstanceBuilder, WeakDom};
use rbx_types::Ref;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::json_value::{variant_from_json, variant_to_json};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SourceFormat {
    Binary,
    Xml,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RbxNode {
    pub id: String,
    pub class_name: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub child_ids: Vec<String>,
    pub properties: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RbxDocument {
    pub nodes: Vec<RbxNode>,
    pub root_ids: Vec<String>,
    pub format: SourceFormat,
    pub diagnostics: Vec<String>,
}

pub fn parse_bytes(bytes: &[u8]) -> Result<RbxDocument, String> {
    if bytes.is_empty() {
        return Err("The file is empty.".into());
    }

    let trimmed = trim_leading(bytes);
    let format = detect_format(trimmed)
        .ok_or_else(|| "This file is not a Roblox binary or XML place/model.".to_string())?;

    let dom = match format {
        SourceFormat::Binary => rbx_binary::from_reader(trimmed).map_err(|error| error.to_string())?,
        SourceFormat::Xml => {
            rbx_xml::from_reader_default(trimmed).map_err(|error| error.to_string())?
        }
    };

    Ok(dom_to_document(&dom, format))
}

pub fn serialize_rbxm_bytes(document: &RbxDocument) -> Result<Vec<u8>, String> {
    serialize_binary(document)
}

pub fn serialize_rbxl_bytes(document: &RbxDocument) -> Result<Vec<u8>, String> {
    serialize_binary(document)
}

fn serialize_binary(document: &RbxDocument) -> Result<Vec<u8>, String> {
    let (dom, root_refs) = document_to_dom(document)?;
    let mut bytes = Vec::new();
    rbx_binary::to_writer(&mut bytes, &dom, &root_refs).map_err(|error| error.to_string())?;
    Ok(bytes)
}

fn detect_format(bytes: &[u8]) -> Option<SourceFormat> {
    if bytes.starts_with(b"<roblox!") {
        Some(SourceFormat::Binary)
    } else if bytes.starts_with(b"<?xml") || bytes.starts_with(b"<roblox") {
        Some(SourceFormat::Xml)
    } else {
        None
    }
}

fn trim_leading(bytes: &[u8]) -> &[u8] {
    let mut bytes = bytes;
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        bytes = &bytes[3..];
    }
    let mut index = 0;
    while index < bytes.len() && bytes[index].is_ascii_whitespace() {
        index += 1;
    }
    &bytes[index..]
}

fn dom_to_document(dom: &WeakDom, format: SourceFormat) -> RbxDocument {
    let mut nodes = Vec::new();
    let mut diagnostics = Vec::new();
    let mut root_ids = Vec::new();

    for &child_ref in dom.root().children() {
        root_ids.push(child_ref.to_string());
        walk(dom, child_ref, None, &mut nodes, &mut diagnostics);
    }

    RbxDocument {
        nodes,
        root_ids,
        format,
        diagnostics,
    }
}

fn walk(
    dom: &WeakDom,
    referent: Ref,
    parent_id: Option<String>,
    nodes: &mut Vec<RbxNode>,
    diagnostics: &mut Vec<String>,
) {
    let instance = dom
        .get_by_ref(referent)
        .expect("child referent missing from WeakDom");
    let id = referent.to_string();
    let mut properties = BTreeMap::new();

    for (key, value) in &instance.properties {
        match variant_to_json(value) {
            Ok(json) => {
                properties.insert(key.to_string(), json);
            }
            Err(error) => diagnostics.push(format!(
                "Skipped property {key} on {} ({}): {error}",
                instance.name, instance.class
            )),
        }
    }

    let child_ids: Vec<String> = instance.children().iter().map(ToString::to_string).collect();
    nodes.push(RbxNode {
        id: id.clone(),
        class_name: instance.class.to_string(),
        name: instance.name.clone(),
        parent_id,
        child_ids: child_ids.clone(),
        properties,
    });

    for child_ref in instance.children() {
        walk(dom, *child_ref, Some(id.clone()), nodes, diagnostics);
    }
}

fn document_to_dom(document: &RbxDocument) -> Result<(WeakDom, Vec<Ref>), String> {
    if document.root_ids.is_empty() {
        return Err("This document has no instances to write.".into());
    }

    let nodes: HashMap<&str, &RbxNode> = document
        .nodes
        .iter()
        .map(|node| (node.id.as_str(), node))
        .collect();

    let mut root = InstanceBuilder::new("DataModel");
    let mut root_refs = Vec::with_capacity(document.root_ids.len());

    for root_id in &document.root_ids {
        let builder = build_instance(root_id, &nodes)?;
        root_refs.push(builder.referent());
        root.add_child(builder);
    }

    Ok((WeakDom::new(root), root_refs))
}

fn build_instance(
    id: &str,
    nodes: &HashMap<&str, &RbxNode>,
) -> Result<InstanceBuilder, String> {
    let node = nodes
        .get(id)
        .copied()
        .ok_or_else(|| format!("Missing instance {id}."))?;
    let referent = Ref::from_str(&node.id).map_err(|error| format!("Bad instance id {id}: {error}"))?;

    let mut builder = InstanceBuilder::new(node.class_name.as_str())
        .with_referent(referent)
        .with_name(&node.name);

    for (key, value) in &node.properties {
        let variant = variant_from_json(value).map_err(|error| {
            format!(
                "Couldn't restore property {key} on {} ({}): {error}",
                node.name, node.class_name
            )
        })?;
        builder.add_property(key.as_str(), variant);
    }

    for child_id in &node.child_ids {
        builder.add_child(build_instance(child_id, nodes)?);
    }

    Ok(builder)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rbx_dom_weak::InstanceBuilder;
    use rbx_types::{Attributes, Variant};

    fn sample_model_bytes() -> Vec<u8> {
        let part = InstanceBuilder::new("Part")
            .with_name("Floor")
            .with_property("Anchored", true)
            .with_child(InstanceBuilder::new("Part").with_name("Killbrick"));
        let dom = WeakDom::new(part);
        let mut bytes = Vec::new();
        rbx_binary::to_writer(&mut bytes, &dom, &[dom.root_ref()]).unwrap();
        bytes
    }

    #[test]
    fn parses_and_roundtrips_a_binary_model() {
        let document = parse_bytes(&sample_model_bytes()).unwrap();
        assert_eq!(document.format, SourceFormat::Binary);
        assert_eq!(document.nodes.len(), 2);
        assert_eq!(document.root_ids.len(), 1);

        let floor = document
            .nodes
            .iter()
            .find(|node| node.name == "Floor")
            .unwrap();
        assert_eq!(floor.class_name, "Part");
        assert_eq!(floor.child_ids.len(), 1);
        assert!(floor.properties.contains_key("Anchored"));

        let rewritten = serialize_rbxm_bytes(&document).unwrap();
        let again = parse_bytes(&rewritten).unwrap();
        assert_eq!(again.nodes.len(), 2);
        let floor = again.nodes.iter().find(|node| node.name == "Floor").unwrap();
        let anchored = floor.properties.get("Anchored").unwrap();
        assert_eq!(anchored, &serde_json::to_value(Variant::Bool(true)).unwrap());
    }

    #[test]
    fn keeps_infinite_floats_across_a_roundtrip() {
        let gui = InstanceBuilder::new("BillboardGui")
            .with_name("ArrowGui")
            .with_property("MaxDistance", f32::INFINITY);
        let dom = WeakDom::new(gui);
        let mut bytes = Vec::new();
        rbx_binary::to_writer(&mut bytes, &dom, &[dom.root_ref()]).unwrap();

        let document = parse_bytes(&bytes).unwrap();
        let gui = document.nodes.iter().find(|node| node.name == "ArrowGui").unwrap();
        assert_eq!(
            gui.properties.get("MaxDistance").unwrap(),
            &serde_json::json!({ "Float32": "Infinity" })
        );

        let again = parse_bytes(&serialize_rbxm_bytes(&document).unwrap()).unwrap();
        let gui = again.nodes.iter().find(|node| node.name == "ArrowGui").unwrap();
        assert_eq!(
            gui.properties.get("MaxDistance").unwrap(),
            &serde_json::json!({ "Float32": "Infinity" })
        );
    }

    #[test]
    fn keeps_infinite_attribute_numbers() {
        let attributes = Attributes::new().with("Uses", f64::INFINITY);
        let part = InstanceBuilder::new("Part")
            .with_name("DialogPart")
            .with_property("Attributes", attributes);
        let dom = WeakDom::new(part);
        let mut bytes = Vec::new();
        rbx_binary::to_writer(&mut bytes, &dom, &[dom.root_ref()]).unwrap();

        let document = parse_bytes(&bytes).unwrap();
        let again = parse_bytes(&serialize_rbxm_bytes(&document).unwrap()).unwrap();
        let part = again.nodes.iter().find(|node| node.name == "DialogPart").unwrap();
        assert_eq!(
            part.properties.get("Attributes").unwrap()["Attributes"]["Uses"]["Float64"],
            "Infinity"
        );
    }

    #[test]
    fn etoh_kit_properties_survive_a_roundtrip_when_the_file_is_present() {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../.dev/etoh-kit-version-6.1.3.rbxl"
        );
        let Ok(bytes) = std::fs::read(path) else {
            return;
        };
        let document = parse_bytes(&bytes).unwrap();
        assert!(document.nodes.iter().any(|node| node.properties.len() > 10));
        let again = parse_bytes(&serialize_rbxm_bytes(&document).unwrap()).unwrap();
        assert_eq!(again.nodes.len(), document.nodes.len());
        let before = document.nodes.iter().find(|node| node.name == "Heal Brick").unwrap();
        let after = again.nodes.iter().find(|node| node.name == "Heal Brick").unwrap();
        assert_eq!(before.properties.get("Anchored"), after.properties.get("Anchored"));
        assert!(before.properties.contains_key("CFrame"));
        assert!(after.properties.contains_key("CFrame"));
    }

    #[test]
    fn parses_xml_model() {
        let xml = br#"<roblox version="4">
            <Item class="Folder" referent="RBX1">
                <Properties>
                    <string name="Name">ClientObjects</string>
                </Properties>
                <Item class="Part" referent="RBX2">
                    <Properties>
                        <string name="Name">Spinner</string>
                    </Properties>
                </Item>
            </Item>
        </roblox>"#;

        let document = parse_bytes(xml).unwrap();
        assert_eq!(document.format, SourceFormat::Xml);
        assert_eq!(document.nodes.len(), 2);
        assert!(document.nodes.iter().any(|node| node.name == "Spinner"));
    }

    #[test]
    fn rejects_unknown_bytes() {
        let error = parse_bytes(b"not a roblox file").unwrap_err();
        assert!(error.contains("not a Roblox"));
    }
}
