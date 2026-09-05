import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Cosmos Native 科学模拟工作台")
    parser.add_argument("command", nargs="?", choices=["gui", "impact"], default="gui")
    parser.add_argument("--spec", type=Path)
    args = parser.parse_args()
    if args.command == "impact":
        from .hydro import MaterialBody, ImpactSettings, prepare_impact, run_swift
        spec = json.loads(args.spec.read_text(encoding="utf-8"))
        settings = ImpactSettings(**spec["settings"])
        directory = prepare_impact(spec["directory"], MaterialBody(**spec["target"]),
            MaterialBody(**spec["impactor"]), settings, spec.get("encounter"))
        run_swift(directory, settings.threads)
    else:
        from .app import launch
        launch()


if __name__ == "__main__":
    main()
