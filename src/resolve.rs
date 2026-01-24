use crate::types::{RouteRecord, RouteState};
use napi_derive::napi;
use regex::Regex;
use std::collections::HashMap;

#[napi]
pub fn resolve_route_native(path: String, routes: Vec<RouteRecord>) -> Option<RouteState> {
    let parts: Vec<&str> = path.splitn(2, '?').collect();
    let pathname = parts[0];
    let query_str = if parts.len() > 1 { parts[1] } else { "" };

    let query = parse_query_string(query_str);

    for route in routes {
        let re = Regex::new(&route.regex).ok()?;
        if let Some(caps) = re.captures(pathname) {
            let mut params = HashMap::new();

            for (i, name) in route.param_names.iter().enumerate() {
                if let Some(m) = caps.get(i + 1) {
                    params.insert(name.clone(), m.as_str().to_string());
                }
            }

            return Some(RouteState {
                path: pathname.to_string(),
                params,
                query,
                matched: Some(route.clone()),
            });
        }
    }

    None
}

pub fn parse_query_string(query: &str) -> HashMap<String, String> {
    let mut params = HashMap::new();
    if query.is_empty() {
        return params;
    }

    for pair in query.split('&') {
        let mut parts = pair.splitn(2, '=');
        let key = parts.next().unwrap_or("");
        let val = parts.next().unwrap_or("");
        if !key.is_empty() {
            params.insert(key.to_string(), val.to_string());
        }
    }

    params
}
