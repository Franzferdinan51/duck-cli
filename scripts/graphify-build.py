#!/usr/bin/env python3
"""
Duck CLI wrapper for graphify build pipeline.
Runs deterministic AST extraction and builds a queryable knowledge graph.
"""

import sys
import json
from pathlib import Path

def main():
    path_str = sys.argv[1] if len(sys.argv) > 1 else "."
    target = Path(path_str).resolve()

    if not target.exists():
        print(f"Path not found: {target}", file=sys.stderr)
        sys.exit(1)

    print(f"🔍 Detecting files in: {target}")
    from graphify.detect import detect
    result = detect(target)
    print(f"   {result['total_files']} files · ~{result['total_words']:,} words")
    code_files = len(result.get('files', {}).get('code', []))
    doc_files = len(result.get('files', {}).get('docs', []))
    image_files = len(result.get('files', {}).get('images', []))
    print(f"   code: {code_files} | docs: {doc_files} | images: {image_files}")

    if result['total_files'] == 0:
        print("No supported files found.")
        sys.exit(0)

    print("\n🔨 Extracting structure (AST pass)...")
    from graphify.extract import extract, collect_files
    from graphify.build import build
    from graphify.cluster import cluster
    from graphify.report import generate
    from graphify.export import to_json, to_html

    # graphify's collect_files filters out paths with dot-parts like .openclaw
    # Work around by using a relative path when possible
    try:
        rel_target = target.relative_to(Path.cwd())
    except ValueError:
        rel_target = target

    files = collect_files(rel_target)
    extractions = []
    try:
        ex = extract(files)
        if ex.get("nodes"):
            extractions.append(ex)
    except Exception as e:
        import traceback
        print(f"   ⚠️  extraction error: {e}")
        traceback.print_exc()

    print(f"   Extracted {len(extractions)} files")

    print("\n🕸️  Building graph...")
    G = build(extractions, directed=True)
    print(f"   {G.number_of_nodes()} nodes · {G.number_of_edges()} edges")

    print("\n📊 Clustering...")
    cluster(G)
    communities = {n: d.get("community", -1) for n, d in G.nodes(data=True)}
    unique_communities = len(set(c for c in communities.values() if c is not None))
    print(f"   {unique_communities} communities detected")

    out_dir = target / "graphify-out"
    out_dir.mkdir(exist_ok=True)

    print("\n💾 Exporting...")
    # Build community mapping for export
    communities_export = {}
    for n, d in G.nodes(data=True):
        comm = d.get("community", 0)
        communities_export.setdefault(comm, []).append(n)

    to_json(G, communities_export, str(out_dir / "graph.json"))
    to_html(G, communities_export, str(out_dir / "graph.html"))

    # Minimal defaults for AST-only report
    from graphify.cluster import score_all
    cohesion_scores = score_all(G, communities_export) if communities_export else {}
    community_labels = {cid: f"Community {cid}" for cid in communities_export}
    god_nodes = sorted(G.degree, key=lambda x: x[1], reverse=True)[:5] if G.number_of_nodes() > 0 else []
    god_node_list = [{"id": n, "label": G.nodes[n].get("label", n), "edges": d} for n, d in god_nodes]
    token_cost = {"input": 0, "output": 0}
    root = str(target)
    suggested_questions = [{"question": f"Explain {god_node_list[0]['label']}", "why": "It is a highly connected node in the graph"}] if god_node_list else []

    report_md = generate(
        G,
        communities_export,
        cohesion_scores,
        community_labels,
        god_node_list,
        [],  # surprise_list
        result,  # detection_result
        token_cost,
        root,
        suggested_questions,
    )
    (out_dir / "GRAPH_REPORT.md").write_text(report_md, encoding="utf-8")

    print(f"\n✅ Done!")
    print(f"   graph.json  → {out_dir / 'graph.json'}")
    print(f"   graph.html  → {out_dir / 'graph.html'}")
    print(f"   GRAPH_REPORT.md → {out_dir / 'GRAPH_REPORT.md'}")

if __name__ == "__main__":
    main()
