class_name PromoRecorder
extends Node
## Records one capture segment for the promo-video skill (its "capture contract"):
## every frame of a SubViewport as `NNNN.png`, plus `capture.json` with the segment's fps,
## size, frame count, `markers` (event name -> frame), `tracks` (per-frame screen points,
## normalized 0..1, or null) and `rects` (normalized [x, y, w, h], from a frame on). The
## game runs at a fixed fps (start Godot with --fixed-fps), so frame n is n / fps seconds of
## game time. PNGs are written on worker threads (at most MAX_PENDING at once); `finish()`
## waits for them.

## Frames being written at once; the next capture waits for the oldest beyond that.
const MAX_PENDING: int = 16

## The viewport being recorded.
var viewport: SubViewport
## Where the segment goes (`<dir>/<segment>/`).
var out_dir: String = ""
var segment: String = ""
var fps: int = 30
var recording: bool = false
var frame_count: int = 0

var _markers: Dictionary = {}
## Track name -> its per-frame values; `_current` holds each track's latest point (sticky).
var _tracks: Dictionary = {}
var _current: Dictionary = {}
var _rects: Dictionary = {}
## Extra facts for the composition: [{frame, ...}] (a drop's tier, what it landed on...).
var _events: Array = []
var _tasks: Array[int] = []


func begin(segment_name: String, recorded: SubViewport, dir: String, frames_per_second: int = 30) -> void:
	segment = segment_name
	viewport = recorded
	out_dir = dir.path_join(segment_name)
	fps = frames_per_second
	DirAccess.make_dir_recursive_absolute(out_dir)
	for file: String in DirAccess.get_files_at(out_dir):
		DirAccess.remove_absolute(out_dir.path_join(file))
	recording = true
	frame_count = 0


## Saves the viewport as the next frame (call once per rendered frame while recording).
func capture() -> void:
	if not recording:
		return
	var image: Image = viewport.get_texture().get_image()
	var path: String = out_dir.path_join("%04d.png" % frame_count)
	_tasks.append(WorkerThreadPool.add_task(_write.bind(image, path)))
	if _tasks.size() > MAX_PENDING:
		WorkerThreadPool.wait_for_task_completion(_tasks.pop_front())
	for track: String in _current:
		var series: Array = _tracks[track]
		while series.size() < frame_count:
			series.append(null)
		series.append(_current[track])
	frame_count += 1


func marker(event: String) -> void:
	if recording and not _markers.has(event):
		_markers[event] = frame_count


## Sets a track's point for this frame on (a screen point in viewport pixels, or null).
func track(track_name: String, point: Variant) -> void:
	if not _tracks.has(track_name):
		_tracks[track_name] = []
	_current[track_name] = _normalize(point) if point != null else null


## A fact about this frame for the composition (e.g. {"type": "drop", "tier": 5}); the skill's
## composition and window search read them.
func event(info: Dictionary) -> void:
	if recording:
		var entry: Dictionary = info.duplicate()
		entry["frame"] = frame_count
		_events.append(entry)


## Sets a numeric track's value for this frame on (e.g. the combo count).
func value(track_name: String, number: float) -> void:
	if not _tracks.has(track_name):
		_tracks[track_name] = []
	_current[track_name] = number


## A region (viewport pixels) the camera frames or a callout points at, from this frame on
## (`rotation`: its tilt in degrees, when it has one).
func rect(rect_name: String, area: Rect2, rotation: float = 0.0) -> void:
	var size: Vector2 = _size()
	_rects[rect_name] = {
		"from": frame_count,
		"rect": [snappedf(area.position.x / size.x, 0.0001), snappedf(area.position.y / size.y,
				0.0001), snappedf(area.size.x / size.x, 0.0001), snappedf(area.size.y / size.y,
				0.0001)],
	}
	if rotation != 0.0:
		_rects[rect_name]["rotation"] = rotation


## The screen rect around a box in the world (all its corners projected).
func project_box(box: AABB, to_world: Transform3D = Transform3D.IDENTITY) -> Rect2:
	var area := Rect2()
	for corner: int in 8:
		var point: Vector2 = project(to_world * box.get_endpoint(corner))
		area = Rect2(point, Vector2.ZERO) if corner == 0 else area.expand(point)
	return area


## Screen point (viewport pixels, the 2D coordinates) of a world position.
func project(world: Vector3) -> Vector2:
	var camera: Camera3D = viewport.get_camera_3d()
	return camera.unproject_position(world) if camera != null else Vector2.ZERO


## Waits for the frames on disk, then writes capture.json.
func finish() -> void:
	recording = false
	for task: int in _tasks:
		WorkerThreadPool.wait_for_task_completion(task)
	_tasks.clear()
	var image_size: Vector2i = viewport.size
	var data: Dictionary = {
		"fps": fps,
		"size": [image_size.x, image_size.y],
		"frames": frame_count,
		"markers": _markers,
		"tracks": _tracks,
		"rects": _rects,
		"events": _events,
	}
	for track: String in _tracks:
		var series: Array = _tracks[track]
		while series.size() < frame_count:
			series.append(null)
	var file := FileAccess.open(out_dir.path_join("capture.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(data))
	print("promo: %s - %d frames, markers %s" % [segment, frame_count, _markers])


## Encodes and writes one frame (on a worker thread: `save_png` itself would notify the scene
## tree from there, which only the main thread may do).
static func _write(image: Image, path: String) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	file.store_buffer(image.save_png_to_buffer())


func _size() -> Vector2:
	return viewport.get_visible_rect().size


func _normalize(point: Vector2) -> Array:
	var size: Vector2 = _size()
	return [snappedf(point.x / size.x, 0.0001), snappedf(point.y / size.y, 0.0001)]
