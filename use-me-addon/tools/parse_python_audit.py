from pathlib import Path
import argparse
import ast
import json

def audit(root: Path):
    ok = []
    bad = []
    for p in root.rglob('*.py'):
        try:
            txt = p.read_text(encoding='utf-8')
        except Exception:
            try:
                txt = p.read_text(encoding='latin1')
            except Exception as e:
                bad.append({'file': str(p), 'error': str(e)})
                continue
        try:
            ast.parse(txt)
            ok.append(str(p))
        except Exception as e:
            bad.append({'file': str(p), 'error': str(e)})
    return {'ok_count': len(ok), 'bad_count': len(bad), 'bad': bad}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default='.')
    args = parser.parse_args()
    print(json.dumps(audit(Path(args.root)), indent=2))

if __name__ == '__main__':
    main()
