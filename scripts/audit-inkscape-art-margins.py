#!/usr/bin/env python3
"""Inkscape transparent illustration safety-margin audit (read-only).

Uses Pillow if available; not a deployment gate. Opaque photos/covers aren't
supposed to have transparent margins unless used as free-floating illustrations.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

def audit(files, minimum=0.1):
    try:
        from PIL import Image
    except ImportError:
        print('Pillow is required to inspect alpha margins. Install it in a temporary environment or use an existing venv with Pillow.',file=sys.stderr)
        return None
    report=[]
    for path in files:
        try:
            with Image.open(path) as im:
                width,height=im.size
                if im.mode not in ('RGBA','LA','PA') and 'transparency' not in im.info:
                    report.append({'file':str(path.relative_to(ROOT)), 'type':'opaque_cover_or_background', 'size':[width,height], 'note':'Do not use as a floating illustration: rectangular pixels are intrinsic.'})
                    continue
                alpha=im.convert('RGBA').getchannel('A')
                # Ignore compression-level alpha values, not visible watercolor edges.
                bounds=alpha.point(lambda value:255 if value >= 8 else 0).getbbox()
                if not bounds:
                    margins=[1.0]*4
                else:
                    left,top,right,bottom=bounds
                    margins=[left/width,top/height,(width-right)/width,(height-bottom)/height]
                # Permit the unavoidable one-pixel rounding of a 10% alpha inset.
                verdict='PASS' if all(value+1/dimension >= minimum for value,dimension in zip(margins,(width,height,width,height))) else 'NEEDS_REVIEW'
                report.append({'file':str(path.relative_to(ROOT)), 'type':'transparent_illustration', 'size':[width,height], 'margins':[round(v,4) for v in margins], 'status':verdict})
        except (OSError, ValueError) as exc:
            report.append({'file':str(path.relative_to(ROOT)), 'type':'invalid', 'error':str(exc)})
    return report

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--file', action='append', type=Path, help='Inspect only specific existing art file(s) (can repeat)')
    parser.add_argument('--report', type=Path, help='Save JSON report; nothing is edited')
    parser.add_argument('--strict', action='store_true', help='Exit nonzero if a transparent illustration is below the 10%% margin')
    args=parser.parse_args()
    if args.file:
        files=[p if p.is_absolute() else ROOT/p for p in args.file]
    else:
        files=sorted(p for p in (ROOT/'frontend/public/art').rglob('*') if p.suffix.lower() in ('.png','.webp','.jpg','.jpeg') and '/ink-masks/' not in str(p))
    if not all(p.is_file() for p in files):
        for p in files:
            if not p.is_file():print(f'File does not exist: {p}',file=sys.stderr)
        return 2
    rows=audit(files)
    if rows is None:return 2
    for item in rows:
        status=item.get('status',item['type'])
        print(f"{status:28} {item['file']} {item.get('margins','')}")
    if args.report:
        args.report.parent.mkdir(exist_ok=True,parents=True)
        args.report.write_text(json.dumps({'minimum_fraction_per_side':.1,'results':rows},indent=2)+'\n')
        print(f'Wrote report: {args.report}')
    offenders=sum(row.get('status')=='NEEDS_REVIEW' for row in rows)
    covers=sum(row['type']=='opaque_cover_or_background' for row in rows)
    print(f'Art audit: {len(rows)} files; {offenders} transparent pieces below 10%; {covers} opaque cover/background assets (must be intentionally framed).')
    return 1 if args.strict and (offenders or any(row['type']=='invalid' for row in rows)) else 0

if __name__=='__main__':sys.exit(main())
