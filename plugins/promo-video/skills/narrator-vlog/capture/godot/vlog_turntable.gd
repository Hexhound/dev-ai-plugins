extends Node
## Dev tool for a narrated vlog: shoots models or a scene on a plain stage, every frame saved
## as out/<name>/NNNN.png (1920x1080), for the before/after shots. Copy this file and
## vlog_turntable.tscn into the game's res://tools/vlog/ (and into the old version's
## worktree, so both versions are shot by the same code).
##
## godot --fixed-fps 30 --disable-vsync --path . res://tools/vlog/vlog_turntable.tscn --
##     out=<dir> name=<clip> scene=<res://a.tscn|a.glb>[,<res://b.tscn>...] [seconds=6]
##     [sway=35 period=10 | turns=1] [yaw=-20] [zoom=1] [bg=#f7eff9] [wireframe=on]
##     [overdraw=on] [rows=1] [fit=0.95] [anim=idle,happy] [freeze=on]
##     [arc=on target=<x,y,z> distance=6 pitch=16 sweep=20] [setup=<res://...gd>]
##
## One scene turns in front of an orthographic camera fitted to it; several stand in a row
## (or rows=) at the same size (fit= metres), one frame. sway= swings it that many degrees
## either side of yaw= (a swing every period= seconds) instead of turning it round, so it
## never shows its back while a line is spoken. wireframe=on draws the triangles in one
## colour; overdraw=on draws every surface see-through and adding up (Godot's overdraw view:
## the brighter, the more surfaces are stacked; heat-xray.py turns it into a heat map). Both
## drop the materials' outline passes. anim= plays the scene's AnimationPlayer clips in turn.
## freeze=on stops the scene's own _process and _physics_process (a menu that tosses things
## in). arc=on: a perspective camera on a slow arc (sweep= degrees around yaw=) looking at
## target= from distance= metres, for a set or a level. setup= names a script with
## `static func setup(root: Node, args: Dictionary) -> void`, called on each scene before it
## enters the tree (so exported settings apply in its _ready; connect to root.ready for
## anything that needs the tree): the place for anything game-specific, such as the game's
## own materials on an imported model, a detail level, an outfit, or nobody in a menu.

const SIZE := Vector2i(1920, 1080)
## Frames being written at once.
const MAX_PENDING: int = 16
## The wireframe's lines: one colour, old and new alike.
const WIRE_COLOR := Color(1.0, 0.86, 0.92)

var _args: Dictionary = {}
var _out: String = "/tmp/vlog"
var _name: String = "clip"
var _seconds: float = 6.0
var _turns: float = 1.0
var _sway: float = 0.0
var _period: float = 10.0
var _yaw: float = -20.0
var _zoom: float = 1.0
var _arc: bool = false
var _target := Vector3.ZERO
var _distance: float = 6.0
var _sweep: float = 20.0
var _pitch: float = 16.0
var _clips: PackedStringArray = PackedStringArray()
var _player: AnimationPlayer
var _frame: int = 0
var _frames: int = 0
var _tasks: Array[int] = []

@onready var _viewport: SubViewport = %Viewport
@onready var _pivot: Node3D = %Pivot
@onready var _camera: Camera3D = %Camera


func _init() -> void:
	# Wireframes need their line meshes made as the meshes load.
	if OS.get_cmdline_user_args().has("wireframe=on"):
		RenderingServer.set_debug_generate_wireframes(true)


func _ready() -> void:
	for arg: String in OS.get_cmdline_user_args():
		var pair: PackedStringArray = arg.split("=", true, 1)
		_args[pair[0]] = pair[1] if pair.size() > 1 else "on"
	_out = _args.get("out", _out)
	_name = _args.get("name", _name)
	_seconds = float(_args.get("seconds", _seconds))
	_turns = float(_args.get("turns", _turns))
	_sway = float(_args.get("sway", _sway))
	_period = float(_args.get("period", _period))
	_yaw = float(_args.get("yaw", _yaw))
	_zoom = float(_args.get("zoom", _zoom))
	_arc = _args.get("arc", "") == "on"
	_target = _vector(_args.get("target", "0,0,0"))
	_distance = float(_args.get("distance", _distance))
	_sweep = float(_args.get("sweep", _sweep))
	_pitch = float(_args.get("pitch", _pitch))
	if _args.has("anim"):
		_clips = (_args["anim"] as String).split(",")
	if _args.has("bg"):
		((%WorldEnvironment as WorldEnvironment).environment).background_color = Color(_args["bg"])
	if _args.get("wireframe", "") == "on":
		_viewport.debug_draw = Viewport.DEBUG_DRAW_WIREFRAME
	elif _args.get("overdraw", "") == "on":
		_viewport.debug_draw = Viewport.DEBUG_DRAW_OVERDRAW

	var paths: PackedStringArray = (_args.get("scene", "") as String).split(",", false)
	var roots: Array[Node3D] = []
	for path: String in paths:
		roots.append(_instance(path))
	if roots.size() > 1:
		_line_up(roots, int(_args.get("rows", "1")), float(_args.get("fit", "0.95")))
		_frames = 1
	else:
		_frames = int(round(_seconds * 30.0))
	if _args.get("wireframe", "") == "on" or _args.get("overdraw", "") == "on":
		_paint_flat()
	if not _clips.is_empty():
		var players: Array[Node] = _pivot.find_children("*", "AnimationPlayer", true, false)
		if not players.is_empty():
			_player = players[0] as AnimationPlayer
	if _arc:
		_camera.projection = Camera3D.PROJECTION_PERSPECTIVE
		_camera.fov = 30.0
	else:
		_fit_camera()
	var dir: String = _out.path_join(_name)
	DirAccess.make_dir_recursive_absolute(dir)
	for file: String in DirAccess.get_files_at(dir):
		DirAccess.remove_absolute(dir.path_join(file))


func _process(_delta: float) -> void:
	# Two frames to settle, then one capture per frame.
	if _frame >= 2:
		var index: int = _frame - 2
		var image: Image = _viewport.get_texture().get_image()
		var path: String = _out.path_join(_name).path_join("%04d.png" % index)
		_tasks.append(WorkerThreadPool.add_task(_write.bind(image, path)))
		if _tasks.size() > MAX_PENDING:
			WorkerThreadPool.wait_for_task_completion(_tasks.pop_front())
		if index + 1 >= _frames:
			for task: int in _tasks:
				WorkerThreadPool.wait_for_task_completion(task)
			print("vlog_turntable: %s %d frames" % [_name, _frames])
			get_tree().quit()
			return
	# get_image() above read the frame drawn after the last call: the pose set now is saved
	# next time, as frame _frame - 1, so frame n shows t = n / 30 (and the last pose is saved).
	var t: float = maxf(_frame - 1, 0) / 30.0
	if _arc:
		_place_camera(t)
	elif _frames > 1:
		if _sway > 0.0:
			_pivot.rotation_degrees.y = _yaw + _sway * sin(TAU * t / _period)
		else:
			_pivot.rotation_degrees.y = _yaw + 360.0 * _turns * t / _seconds
	if _player != null:
		var slot: float = _seconds / _clips.size()
		if fmod(t, slot) < 1.0 / 30.0:
			_player.play(_clips[mini(int(t / slot), _clips.size() - 1)])
	_frame += 1


## A scene (or an imported model) under the pivot, set up and, with freeze=on, idle.
func _instance(path: String) -> Node3D:
	var root := (load(path) as PackedScene).instantiate() as Node3D
	if _args.has("setup"):
		var setup: Script = load(_args["setup"])
		setup.call(&"setup", root, _args)
	_pivot.add_child(root)
	if _args.get("freeze", "") == "on":
		root.set_process(false)
		root.set_physics_process(false)
	return root


## The scenes in `rows` rows (the last one shorter), each scaled so its largest side is
## `fit` metres: the same size, so their shapes compare.
func _line_up(roots: Array[Node3D], rows: int, fit: float) -> void:
	var per_row: int = ceili(float(roots.size()) / rows)
	var spacing: float = fit * 1.1
	for i: int in roots.size():
		var box: AABB = _bounds(roots[i])
		roots[i].scale *= fit / maxf(box.size[box.get_longest_axis_index()], 0.001)
		roots[i].rotation_degrees.y = _yaw * 0.6
		# Each one centred on its place, whatever its own origin.
		var centre: Vector3 = _bounds(roots[i]).get_center()
		var row: int = i / per_row
		var in_row: int = mini(per_row, roots.size() - row * per_row)
		var column: int = i - row * per_row
		roots[i].position = Vector3((column - (in_row - 1) * 0.5) * spacing - centre.x,
				((rows - 1) * 0.5 - row) * spacing * 1.1 - centre.y, -centre.z)


## The orthographic camera framing everything under the pivot, with a margin, whichever way
## it turns (the width is the larger of its x and z sizes).
func _fit_camera() -> void:
	var box: AABB = _bounds(_pivot)
	var width: float = maxf(box.size.x, box.size.z)
	var aspect: float = float(SIZE.x) / float(SIZE.y)
	_camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	_camera.size = maxf(box.size.y, width / aspect) * 1.25 / _zoom
	var centre: Vector3 = box.get_center()
	_camera.position = Vector3(centre.x, centre.y, centre.z + maxf(width, box.size.y) * 4.0 + 1.0)
	_camera.rotation = Vector3.ZERO
	if _args.has("look"):
		var point: Vector3 = _vector(_args["look"] + ",0")
		_camera.position.x = point.x
		_camera.position.y = point.y


## The camera on its arc at t seconds, from yaw - sweep / 2 to yaw + sweep / 2.
func _place_camera(t: float) -> void:
	var yaw: float = deg_to_rad(_yaw + _sweep * (t / _seconds - 0.5))
	var pitch: float = deg_to_rad(_pitch)
	var offset := Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch))
	_camera.position = _target + offset * _distance / _zoom
	_camera.look_at(_target)


## Every mesh in WIRE_COLOR, unshaded, without the outline pass its material may chain (its
## own colours would hide the lines, and the outline would count as one more surface).
func _paint_flat() -> void:
	var flat := StandardMaterial3D.new()
	flat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	flat.albedo_color = WIRE_COLOR
	for node: Node in _pivot.find_children("*", "GeometryInstance3D", true, false):
		(node as GeometryInstance3D).material_override = flat


## The world-space box around every visual under `root`.
static func _bounds(root: Node3D) -> AABB:
	var box := AABB()
	var first: bool = true
	for node: Node in root.find_children("*", "VisualInstance3D", true, false):
		var visual := node as VisualInstance3D
		var part: AABB = visual.global_transform * visual.get_aabb()
		box = part if first else box.merge(part)
		first = false
	return box


static func _vector(text: String) -> Vector3:
	var parts: PackedStringArray = text.split(",")
	return Vector3(float(parts[0]), float(parts[1]), float(parts[2]))


static func _write(image: Image, path: String) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	file.store_buffer(image.save_png_to_buffer())
