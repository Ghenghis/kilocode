from pathlib import Path
import argparse
import json

KEYWORDS = [
  "stub",
  "todo",
  "placeholder",
  "mock",
  "not started",
  "requires implementation",
  "pending",
  "0%"
]

def scan(root: Path):
    results = []
    for p in root.rglob('*'):
        if not p.is_file():
            continue
        if p.suffix.lower() not in {'.md', '.py', '.json', '.txt', '.yml', '.yaml'}:
            continue
        try:
            txt = p.read_text(encoding='utf-8')
        except Exception:
            try:
                txt = p.read_text(encoding='latin1')
            except Exception:
                continue
        low = txt.lower()
        found = [kw for kw in KEYWORDS if kw in low]
        if found:
            results.append({'file': str(p), 'markers': found})
    return results

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default='.')
    args = parser.parse_args()
    results = scan(Path(args.root))
    print(json.dumps({'count': len(results), 'results': results}, indent=2))

if __name__ == '__main__':
    main()
