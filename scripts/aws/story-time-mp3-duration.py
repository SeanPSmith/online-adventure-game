#!/usr/bin/env python3
"""Measure MPEG Layer III duration using only Python stdlib, even without ffprobe.

Walks MP3 frames rather than inferring duration from total file size. Supports
MPEG 1/2/2.5 Layer III, CBR/VBR, and leading ID3v2 metadata.
"""
import os
import sys

RATES = {
    3: [44100, 48000, 32000],
    2: [22050, 24000, 16000],
    0: [11025, 12000, 8000],
}
BITRATES = {
    3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
    0: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
}


def duration_seconds(path):
    with open(path, "rb") as f:
        data = f.read()
    offset = 0
    if data[:3] == b"ID3" and len(data) >= 10:
        size = ((data[6] & 127) << 21) | ((data[7] & 127) << 14) | ((data[8] & 127) << 7) | (data[9] & 127)
        offset = 10 + size + (10 if data[5] & 0x10 else 0)
    total_samples = 0.0
    frames = 0
    while offset + 4 <= len(data):
        h = int.from_bytes(data[offset:offset + 4], "big")
        version = (h >> 19) & 3
        layer = (h >> 17) & 3
        bridx = (h >> 12) & 15
        sridx = (h >> 10) & 3
        if (h >> 21) != 0x7ff or version == 1 or layer != 1 or bridx in (0, 15) or sridx == 3:
            if frames:
                # Padding, ID3v1 or non-audio tags at the end of an MP3.
                break
            offset += 1
            continue
        sr = RATES[version][sridx]
        br = BITRATES[version][bridx] * 1000
        samples = 1152 if version == 3 else 576
        frame_bytes = (144 if version == 3 else 72) * br // sr + ((h >> 9) & 1)
        if frame_bytes <= 4 or offset + frame_bytes > len(data):
            break
        total_samples += samples / sr
        frames += 1
        offset += frame_bytes
    if not frames:
        raise ValueError(f"No valid MP3 frames in {os.path.basename(path)}")
    return total_samples


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: story-time-mp3-duration.py FILE.mp3")
    print(f"{duration_seconds(sys.argv[1]):.3f}")
