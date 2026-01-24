use crate::types::{ParsedSegment, RouteRecord, SegmentType};
use napi_derive::napi;
use std::path::Path;
use walkdir::WalkDir;

const STATIC_SCORE: i32 = 10;
const DYNAMIC_SCORE: i32 = 5;
const CATCH_ALL_SCORE: i32 = 1;
const OPTIONAL_CATCH_ALL_SCORE: i32 = 0;

pub fn discover_pages(pages_dir: &str) -> Vec<String> {
    let mut pages = Vec::new();
    for entry in WalkDir::new(pages_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().is_file() && e.path().extension().map_or(false, |ext| ext == "zen")
        })
    {
        pages.push(entry.path().to_string_lossy().to_string());
    }
    pages
}

pub fn file_path_to_route_path(file_path: &str, pages_dir: &str) -> String {
    let base = Path::new(pages_dir);
    let path = Path::new(file_path);
    let relative = path.strip_prefix(base).unwrap_or(path);

    let without_ext = relative.with_extension("");
    let components: Vec<String> = without_ext
        .components()
        .map(|c| c.as_os_str().to_string_lossy().to_string())
        .collect();

    let mut route_segments = Vec::new();
    for segment in components {
        if segment == "index" {
            continue;
        }

        if segment.starts_with("[[...") && segment.ends_with("]]") {
            let param = &segment[5..segment.len() - 2];
            route_segments.push(format!("*{}?", param));
            continue;
        }

        if segment.starts_with("[...") && segment.ends_with("]") {
            let param = &segment[4..segment.len() - 1];
            route_segments.push(format!("*{}", param));
            continue;
        }

        if segment.starts_with("[") && segment.ends_with("]") {
            let param = &segment[1..segment.len() - 1];
            route_segments.push(format!(":{}", param));
            continue;
        }

        route_segments.push(segment);
    }

    let mut route_path = format!("/{}", route_segments.join("/"));
    if route_path.len() > 1 && route_path.ends_with("/") {
        route_path.pop();
    }
    route_path
}

pub fn parse_route_segments(route_path: &str) -> Vec<ParsedSegment> {
    if route_path == "/" {
        return Vec::new();
    }

    let segments = route_path[1..].split('/');
    let mut parsed = Vec::new();

    for segment in segments {
        if segment.is_empty() {
            continue;
        }

        if segment.starts_with('*') && segment.ends_with('?') {
            parsed.push(ParsedSegment {
                segment_type: SegmentType::OptionalCatchAll,
                param_name: Some(segment[1..segment.len() - 1].to_string()),
                raw: segment.to_string(),
            });
        } else if segment.starts_with('*') {
            parsed.push(ParsedSegment {
                segment_type: SegmentType::CatchAll,
                param_name: Some(segment[1..].to_string()),
                raw: segment.to_string(),
            });
        } else if segment.starts_with(':') {
            parsed.push(ParsedSegment {
                segment_type: SegmentType::Dynamic,
                param_name: Some(segment[1..].to_string()),
                raw: segment.to_string(),
            });
        } else {
            parsed.push(ParsedSegment {
                segment_type: SegmentType::Static,
                param_name: None,
                raw: segment.to_string(),
            });
        }
    }
    parsed
}

pub fn calculate_route_score(segments: &[ParsedSegment]) -> i32 {
    if segments.is_empty() {
        return 100;
    }

    let mut score = 0;
    let mut static_count = 0;

    for segment in segments {
        score += match segment.segment_type {
            SegmentType::Static => {
                static_count += 1;
                STATIC_SCORE
            }
            SegmentType::Dynamic => DYNAMIC_SCORE,
            SegmentType::CatchAll => CATCH_ALL_SCORE,
            SegmentType::OptionalCatchAll => OPTIONAL_CATCH_ALL_SCORE,
        };
    }

    score += static_count * 2;
    score
}

pub fn route_path_to_regex_pattern(route_path: &str) -> String {
    if route_path == "/" {
        return r"^\/$".to_string();
    }

    let segments: Vec<&str> = route_path[1..]
        .split('/')
        .filter(|s| !s.is_empty())
        .collect();
    let mut regex_parts = Vec::new();

    for segment in segments {
        if segment.starts_with('*') && segment.ends_with('?') {
            regex_parts.push(r"(?:\/(.*))?".to_string());
        } else if segment.starts_with('*') {
            regex_parts.push(r"\/(.+)".to_string());
        } else if segment.starts_with(':') {
            regex_parts.push(r"\/([^/]+)".to_string());
        } else {
            let escaped = regex::escape(segment);
            regex_parts.push(format!(r"\/{}", escaped));
        }
    }

    format!(r"^{}\/?$", regex_parts.join(""))
}

#[napi]
pub fn generate_route_manifest_native(pages_dir: String) -> Vec<RouteRecord> {
    let pages = discover_pages(&pages_dir);
    let mut definitions = Vec::new();

    for file_path in pages {
        let route_path = file_path_to_route_path(&file_path, &pages_dir);
        let segments = parse_route_segments(&route_path);
        let param_names = segments
            .iter()
            .filter_map(|s| s.param_name.clone())
            .collect();
        let score = calculate_route_score(&segments);
        let regex = route_path_to_regex_pattern(&route_path);

        definitions.push(RouteRecord {
            path: route_path,
            regex,
            param_names,
            score,
            file_path,
        });
    }

    definitions.sort_by(|a, b| b.score.cmp(&a.score));
    definitions
}
