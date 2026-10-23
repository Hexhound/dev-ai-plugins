#!/usr/bin/env bash
# Records the devlog's footage into devlog/capture/<clip>/NNNN.png, from the old game (v1.0.0,
# the `old_` clips) and this one (the `new_` clips), with the same tools and settings.
#   devlog/capture.sh [step ...]     steps: chibis props worlds night f1 (default: all)
# The old game is a git worktree of v1.0.0 (V1, default ../chibi_chuu_v1) with this branch's
# devlog tools and promo recorder copied in (they only use what v1.0.0 has too):
#   git worktree add ../chibi_chuu_v1 master
#   cp -r tools/devlog ../chibi_chuu_v1/tools/
#   cp tools/promo/promo_play.gd tools/promo/promo_recorder.gd ../chibi_chuu_v1/tools/promo/
#   godot --headless --path ../chibi_chuu_v1 --import
# Never commit that worktree's copies to master; remove it after (git worktree remove --force).
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
new=$(cd "$here/.." && pwd)
old=$(cd "${V1:-$new/../chibi_chuu_v1}" && pwd)
out=$here/capture
mkdir -p "$out"
steps=${*:-chibis props worlds night f1}

# A chibi turntable, a line-up or the empty playground (tools/devlog/turntable.gd).
tt() {
  local game=$1; shift
  timeout 900 godot --fixed-fps 30 --disable-vsync --path "$game" res://tools/devlog/turntable.tscn -- out="$out" "$@" 2>&1 | grep -E "turntable:|ERROR"
}
# A mode playing itself, recorded by the promo's tools (tools/promo/promo_play.gd).
world() {
  local game=$1; shift
  timeout 1800 godot --fixed-fps 30 --disable-vsync --path "$game" res://tools/promo/promo_world.tscn -- promo_out="$out" no_screen=on landscape=on seed=7 "$@" 2>&1 | grep -E "promo: [a-z_]* -|SCRIPT ERROR" | cut -c1-80
}

if [[ " $steps " == *" chibis "* ]]; then
  # The fox swinging (the same sway in both, so old and new line up): plain, her wireframe,
  # and the x-ray (made into heat maps), plus the new one's Low detail wireframe for the F1
  # shot; then her face through five expressions, and every tier in a row (and in a grid).
  sway="id=fox seconds=10 sway=35 period=10 yaw=-20"
  tt "$old" name=old_fox $sway zoom=0.8 &
  tt "$new" name=new_fox $sway level=8000 &
  tt "$old" name=old_fox_wire $sway zoom=0.8 wireframe=on bg=#2b1a33 &
  tt "$new" name=new_fox_wire $sway level=8000 wireframe=on bg=#2b1a33 &
  wait
  tt "$new" name=new_fox_wire_2500 $sway level=2500 wireframe=on bg=#2b1a33 &
  tt "$old" name=old_fox_xray $sway zoom=0.8 overdraw=on &
  tt "$new" name=new_fox_xray $sway level=8000 overdraw=on &
  wait
  python3 -I "$here/heat_xray.py" "$out/old_fox_xray" "$out/new_fox_xray"
  face="id=fox turns=0 yaw=0 seconds=14 clips=blink,happy,excited,surprised,happy"
  tt "$old" name=old_fox_face $face zoom=1.7 &
  tt "$new" name=new_fox_face $face zoom=2.1 level=8000 &
  tt "$old" name=old_lineup lineup=on zoom=1.07 &
  tt "$new" name=new_lineup lineup=on zoom=1.07 level=8000 &
  tt "$new" name=new_lineup_grid lineup=on rows=2 level=8000 &
  wait
fi

if [[ " $steps " == *" props "* ]]; then
  # The menu's playground with nobody in it: a wide arc, then the slide and the sand pit.
  for pair in "$old old" "$new new"; do
    set -- $pair
    tt "$1" name=$2_props_wide bg=#e9e0f6 props=on yaw=0 sweep=16 seconds=4.4 target=0,-1.85,2 distance=9 pitch=20 &
    tt "$1" name=$2_props_close bg=#e9e0f6 props=on yaw=12 sweep=14 seconds=5.0 target=-1.9,-1.5,2.5 distance=4.6 pitch=20 &
  done
  wait
fi

if [[ " $steps " == *" worlds "* ]]; then
  # Classic by day and at dusk, and the seven modes (the promo's settings).
  for pair in "$old old" "$new new"; do
    set -- $pair
    extra=$([[ $2 == new ]] && echo chibis=8000)
    common="record_from=30 record_to=34 $extra"
    world "$1" segment=$2_classic_day mode=classic phase=day background=lavender_watercolor drop_interval=1.0 $common &
    world "$1" segment=$2_classic_dusk mode=classic phase=dusk background=lavender_watercolor drop_interval=1.0 $common &
    world "$1" segment=$2_sphere mode=sphere phase=day drop_interval=0.9 background=lavender_watercolor $common &
    world "$1" segment=$2_water mode=water phase=day drop_interval=1.2 background=sky_blue frame_inset=0.07 $common &
    wait
    world "$1" segment=$2_star mode=star_bubble phase=day drop_interval=1.6 $common &
    world "$1" segment=$2_ball mode=ball_pool phase=day drop_interval=1.4 background=lilac_bokeh $common &
    world "$1" segment=$2_candy mode=candy_scale phase=day drop_interval=1.4 background=mint_meadow $common &
    world "$1" segment=$2_tower mode=hug_tower phase=day drop_interval=1.6 record_from=10 record_to=14 $extra &
    wait
  done
fi

if [[ " $steps " == *" night "* ]]; then
  # Night in Classic, calm: no drops after 22 s, so the pile settles and dozes off.
  world "$old" segment=old_night_calm mode=classic phase=night background=lavender_watercolor drop_interval=1.0 drops_until=22 record_from=26 record_to=40 &
  world "$new" segment=new_night_calm mode=classic phase=night background=lavender_watercolor drop_interval=1.0 drops_until=22 record_from=26 record_to=40 chibis=8000 &
  wait
fi

if [[ " $steps " == *" f1 "* ]]; then
  # The F1 panel swapping the chibis' model live. The panel lives in the window, so this one
  # is Movie Maker at 1920x1080 (a temporary override.cfg), cut to the panel's 10.5 s.
  avi=$(mktemp -u /tmp/devlog_f1_XXXX.avi)
  printf '[display]\n\nwindow/size/window_width_override=1920\nwindow/size/window_height_override=1080\n' > "$new/override.cfg"
  timeout 1800 godot --path "$new" res://tools/devlog/f1_panel.tscn --write-movie "$avi" --fixed-fps 30 --disable-vsync > /dev/null 2>&1 &
  pid=$!
  sleep 10
  rm -f "$new/override.cfg"
  wait $pid
  rm -rf "$out/f1_panel" && mkdir -p "$out/f1_panel"
  ffmpeg -loglevel error -y -ss 23.4 -t 10.5 -i "$avi" -vf fps=30 -start_number 0 "$out/f1_panel/%04d.png"
  rm -f "$avi"
  echo "f1_panel $(ls "$out/f1_panel" | wc -l) frames"
fi
