#!/bin/sh

mkdir -p ".downloads/h264"

for f in $(ls .downloads/*.mov); do
    in_file=".downloads/${f}"
    out_file=".downloads/h264/${f%.*}.mp4"

    if [ ! -f "${out_file}" ]; then
        HandBrakeCLI --preset-import-file ./handbrake-preset-H264.json -Z H264 -i "${in_file}" -o "${out_file}"
    fi
done
