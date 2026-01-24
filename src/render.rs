use napi_derive::napi;

#[napi]
pub fn render_route_native(input_json: String) -> String {
    // This needs actual ZenIR parsing/types to work properly
    // For now we placeholder since we are separate from compiler-native
    format!("<!-- Native SSR Placeholder for {} -->", input_json)
}
