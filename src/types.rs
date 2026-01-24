use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[napi]
#[derive(Debug, Serialize, Deserialize)]
pub enum SegmentType {
    Static,
    Dynamic,
    CatchAll,
    OptionalCatchAll,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct ParsedSegment {
    pub segment_type: SegmentType,
    pub param_name: Option<String>,
    pub raw: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct RouteRecord {
    pub path: String,
    pub regex: String,
    pub param_names: Vec<String>,
    pub score: i32,
    pub file_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct RouteState {
    pub path: String,
    pub params: HashMap<String, String>,
    pub query: HashMap<String, String>,
    pub matched: Option<RouteRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct RouteManifest {
    pub routes: Vec<RouteRecord>,
    pub generated_at: i64,
}
