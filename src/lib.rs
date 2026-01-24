use napi_derive::napi;

pub mod manifest;
pub mod render;
pub mod resolve;
pub mod runtime_gen;
pub mod types;

pub use manifest::*;
pub use render::*;
pub use resolve::*;
pub use runtime_gen::*;
pub use types::*;

#[napi]
pub fn router_bridge() -> String {
    "Zenith Router Native Bridge Connected".to_string()
}
