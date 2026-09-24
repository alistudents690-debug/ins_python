/*
 * Runs the player's Python code with Pyodide inside a Web Worker,
 * so a never-ending loop can't freeze the page.
 */
/* global importScripts, loadPyodide, SnakeEngine */
'use strict';

var PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

importScripts('engine.js');

var currentGame = null;

// The functions Python's `_snake` module talks to.
var snakeBridge = {
  move: function (dir) { return currentGame ? currentGame.move(dir) : 'NO_SNAKE'; },
  can_move: function (dir) { return currentGame ? currentGame.canMove(dir) : false; },
  apples_left: function () { return currentGame ? currentGame.applesLeft() : 0; },
  apple_direction: function () { return currentGame ? currentGame.appleDirection() : 'none'; },
  say: function (text) { if (currentGame) currentGame.say(text); },
  print_line: function (text) { if (currentGame) currentGame.print(text); },
  has_snake: function () { return !!currentGame; }
};

var PRELUDE = String.raw`
import sys, ast, difflib, builtins, json, traceback
import _snake

USER_FILE = "<your code>"
DIRECTIONS = ("up", "down", "left", "right")

class SnakeCrash(BaseException):
    pass

class TooLong(BaseException):
    pass

class NoSnake(Exception):
    pass

def _need_snake(name):
    if not _snake.has_snake():
        raise NoSnake(name + "() only works in the snake game. Here in practice mode you can use print() and normal Python!")

def _direction(d, name):
    if not isinstance(d, str):
        raise TypeError(name + '() needs a direction in quotes, like ' + name + '("right")')
    d2 = d.strip().lower()
    if d2 not in DIRECTIONS:
        raise ValueError('"' + d + '" is not a direction. Use "up", "down", "left" or "right".')
    return d2

def _steps(n, name):
    if isinstance(n, bool) or not isinstance(n, int):
        raise TypeError(name + '() needs a whole number of steps, like ' + name + '(3)')
    if n < 0:
        raise ValueError("The number of steps can't be less than 0.")
    return n

def move(direction, steps=1):
    _need_snake("move")
    d = _direction(direction, "move")
    for _ in range(_steps(steps, "move")):
        crash = _snake.move(d)
        if crash:
            raise SnakeCrash(str(crash))

def move_up(steps=1):
    move("up", _steps(steps, "move_up"))

def move_down(steps=1):
    move("down", _steps(steps, "move_down"))

def move_left(steps=1):
    move("left", _steps(steps, "move_left"))

def move_right(steps=1):
    move("right", _steps(steps, "move_right"))

def can_move(direction):
    _need_snake("can_move")
    return bool(_snake.can_move(_direction(direction, "can_move")))

def apples_left():
    _need_snake("apples_left")
    return int(_snake.apples_left())

def apple_direction():
    _need_snake("apple_direction")
    return str(_snake.apple_direction())

def say(*words):
    _need_snake("say")
    _snake.say(" ".join(str(w) for w in words))

def _no_input(*args):
    raise RuntimeError("input() can't be used here. Put the value straight into a variable instead, like: name = \"Sam\"")

GAME_API = {
    "move": move, "move_up": move_up, "move_down": move_down,
    "move_left": move_left, "move_right": move_right,
    "can_move": can_move, "apples_left": apples_left,
    "apple_direction": apple_direction, "say": say, "input": _no_input,
}

class _Out:
    def __init__(self):
        self.buf = ""
        self.all = []
    def write(self, s):
        self.buf += s
        while "\n" in self.buf:
            line, self.buf = self.buf.split("\n", 1)
            self.all.append(line)
            _snake.print_line(line)
        return len(s)
    def flush(self):
        pass
    def finish(self):
        if self.buf:
            self.all.append(self.buf)
            _snake.print_line(self.buf)
            self.buf = ""

KNOWN_WORDS = list(GAME_API) + [n for n in dir(builtins) if not n.startswith("_")] + [
    "for", "while", "if", "else", "elif", "def", "return", "in", "range", "True", "False", "None", "and", "or", "not",
]

def _user_line(tb):
    line = None
    for frame in traceback.extract_tb(tb):
        if frame.filename == USER_FILE:
            line = frame.lineno
    return line

def _code_line(code, n):
    lines = code.split("\n")
    if n and 1 <= n <= len(lines):
        return lines[n - 1]
    return ""

BLOCK_WORDS = ("for ", "while ", "if ", "elif ", "else", "def ")

def explain_syntax(e, code):
    n = e.lineno or 1
    text = _code_line(code, n)
    stripped = text.strip()
    raw = type(e).__name__ + ": " + str(e.msg)
    if isinstance(e, IndentationError) or "indent" in str(e.msg):
        if "expected an indented block" in str(e.msg):
            msg = "The line after a colon ':' must be pushed in with 4 spaces, so Python knows it belongs inside."
        elif "unexpected indent" in str(e.msg):
            msg = "This line has extra spaces at the start. Only lines inside a loop, if or def are pushed in."
        else:
            msg = "The spaces at the start of this line don't match the lines around it. Use 4 spaces for each step in."
        return {"status": "error", "title": "Spaces problem on line %d" % n, "message": msg, "line": n, "raw": raw}
    msg = "Python couldn't understand this line."
    if stripped.startswith(BLOCK_WORDS) and not stripped.endswith(":"):
        msg = "Lines that start with for, while, if, elif, else or def must end with a colon ':'"
    elif stripped.count("(") != stripped.count(")"):
        msg = "Check your brackets ( ). Every ( needs a matching )."
    elif stripped.count('"') % 2 == 1 or stripped.count("'") % 2 == 1:
        msg = "A piece of text is missing a quote mark. Text needs quotes at both ends, like \"hello\"."
    elif stripped.startswith("print ") and "(" not in stripped:
        msg = "print needs brackets, like: print(\"hello\")"
    elif "=" in stripped and stripped.startswith(("if ", "while ", "elif ")) and "==" not in stripped and "!=" not in stripped and "<=" not in stripped and ">=" not in stripped:
        msg = "To check if two things are equal, use two equal signs: ==   (one = is for putting a value in a variable)"
    elif "was never closed" in str(e.msg):
        msg = "Something was opened but never closed. Check your brackets and quotes."
    return {"status": "error", "title": "Oops! Line %d has a typo" % n, "message": msg, "line": n, "raw": raw}

def explain_runtime(e, code, ns):
    n = _user_line(e.__traceback__)
    raw = type(e).__name__ + ": " + str(e)
    where = ("Line %d: " % n) if n else ""
    if isinstance(e, NameError):
        name = getattr(e, "name", None)
        if not name:
            parts = str(e).split("'")
            name = parts[1] if len(parts) > 1 else "?"
        options = KNOWN_WORDS + [k for k in ns if not k.startswith("_")]
        close = difflib.get_close_matches(name, options, n=1, cutoff=0.6)
        msg = "Python doesn't know the word '%s'." % name
        if close:
            msg += " Did you mean '%s'?" % close[0]
        else:
            msg += " Did you make a variable with that name first? Or forget quotes around text?"
        return {"status": "error", "title": where + "Unknown word", "message": msg, "line": n, "raw": raw}
    if isinstance(e, NoSnake):
        return {"status": "error", "title": where + "No snake here", "message": str(e), "line": n, "raw": raw}
    if isinstance(e, TypeError):
        s = str(e)
        if "missing" in s and "required positional argument" in s:
            msg = "A function needs more information inside its brackets. " + s
        elif "takes" in s and "given" in s:
            msg = "You gave a function too many things inside its brackets. " + s
        elif "can only concatenate str" in s or "unsupported operand" in s:
            msg = "You can't add text and numbers together directly. Try str(number) to turn a number into text."
        elif "not callable" in s:
            msg = "Something here isn't a function, so you can't use ( ) after it."
        else:
            msg = s
        return {"status": "error", "title": where + "Wrong type of thing", "message": msg, "line": n, "raw": raw}
    if isinstance(e, ValueError):
        return {"status": "error", "title": where + "Hmm, strange value", "message": str(e), "line": n, "raw": raw}
    if isinstance(e, ZeroDivisionError):
        return {"status": "error", "title": where + "Divide by zero", "message": "Nobody can divide by 0, not even Python!", "line": n, "raw": raw}
    if isinstance(e, IndexError):
        return {"status": "error", "title": where + "List is too short", "message": "You asked for a position in a list that doesn't exist. Lists start counting at 0!", "line": n, "raw": raw}
    if isinstance(e, RecursionError):
        return {"status": "error", "title": where + "Function calls itself forever", "message": "Your function keeps calling itself and never stops.", "line": n, "raw": raw}
    if isinstance(e, AssertionError):
        return {"status": "error", "title": "Not quite right yet", "message": str(e) or "One of the checks failed.", "line": n, "raw": raw}
    return {"status": "error", "title": where + type(e).__name__, "message": str(e), "line": n, "raw": raw}

def analyse(code):
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return {"uses": [], "lines": 0}
    uses = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.For, ast.comprehension)):
            uses.add("for")
        elif isinstance(node, ast.While):
            uses.add("while")
        elif isinstance(node, ast.IfExp):
            uses.add("if")
        elif isinstance(node, ast.If):
            uses.add("if")
            if node.orelse:
                if len(node.orelse) == 1 and isinstance(node.orelse[0], ast.If):
                    uses.add("elif")
                else:
                    uses.add("else")
        elif isinstance(node, ast.FunctionDef):
            uses.add("def")
            if node.args.args:
                uses.add("parameter")
        elif isinstance(node, ast.Return):
            uses.add("return")
        elif isinstance(node, (ast.List, ast.ListComp)):
            uses.add("list")
        elif isinstance(node, (ast.Assign, ast.AugAssign)):
            uses.add("variable")
        elif isinstance(node, ast.Compare):
            uses.add("compare")
        elif isinstance(node, ast.Call):
            f = node.func
            if isinstance(f, ast.Name):
                uses.add("call:" + f.id)
            elif isinstance(f, ast.Attribute):
                uses.add("call:." + f.attr)
    lines = 0
    for line in code.split("\n"):
        s = line.strip()
        if s and not s.startswith("#"):
            lines += 1
    return {"uses": sorted(uses), "lines": lines}

def run_player(code, line_limit, tests):
    out = _Out()
    ns = {"__name__": "__main__"}
    ns.update(GAME_API)
    try:
        compiled = compile(code, USER_FILE, "exec")
    except SyntaxError as e:
        return json.dumps(explain_syntax(e, code))

    count = [0]
    def tracer(frame, event, arg):
        if frame.f_code.co_filename != USER_FILE:
            return None
        if event == "line":
            count[0] += 1
            if count[0] > line_limit:
                raise TooLong(frame.f_lineno)
        return tracer

    result = {"status": "ok"}
    old_out = sys.stdout
    sys.stdout = out
    sys.settrace(tracer)
    try:
        exec(compiled, ns)
    except SnakeCrash as e:
        result = {"status": "crash", "message": str(e), "line": _user_line(e.__traceback__)}
    except TooLong as e:
        n = e.args[0] if e.args else None
        result = {"status": "error", "title": "Your code never stops!",
                  "message": "A loop keeps going round and round forever. Check that your while loop can become False.",
                  "line": n, "raw": "Loop limit reached"}
    except Exception as e:
        result = explain_runtime(e, code, ns)
    finally:
        sys.settrace(None)
        sys.stdout = old_out
        out.finish()

    if result["status"] == "ok" and tests:
        sys.stdout = out
        try:
            exec(compile(tests, "<check>", "exec"), ns)
        except AssertionError as e:
            result = {"status": "fail", "message": str(e) or "Not quite right yet."}
        except Exception as e:
            result = {"status": "fail", "message": "The checker had a problem with your code: " + type(e).__name__ + ": " + str(e)}
        finally:
            sys.stdout = old_out
            out.finish()

    result["output"] = out.all
    return json.dumps(result)
`;

var pyodideReady = (async function () {
  importScripts(PYODIDE_URL + 'pyodide.js');
  var py = await loadPyodide({ indexURL: PYODIDE_URL });
  py.registerJsModule('_snake', snakeBridge);
  py.runPython(PRELUDE);
  return py;
})();

pyodideReady.then(
  function () { self.postMessage({ type: 'ready' }); },
  function (err) { self.postMessage({ type: 'load-error', message: String(err && err.message || err) }); }
);

function runOnce(py, code, lineLimit, tests) {
  var fn = py.globals.get('run_player');
  try {
    return JSON.parse(fn(code, lineLimit, tests || ''));
  } finally {
    fn.destroy();
  }
}

self.onmessage = async function (ev) {
  var msg = ev.data;
  if (msg.type !== 'run') return;
  var py;
  try {
    py = await pyodideReady;
  } catch (err) {
    self.postMessage({ type: 'result', id: msg.id, fatal: 'Python could not load: ' + err });
    return;
  }
  var lineLimit = msg.lineLimit || 100000;
  var analyse = py.globals.get('analyse');
  var analysis = analyse(msg.code).toJs({ dict_converter: Object.fromEntries });
  analyse.destroy();

  if (msg.mode === 'practice') {
    currentGame = null;
    var res = runOnce(py, msg.code, lineLimit, msg.tests);
    self.postMessage({ type: 'result', id: msg.id, practice: res, analysis: analysis });
    return;
  }

  var runs = [];
  var maps = msg.maps || [];
  for (var i = 0; i < maps.length; i++) {
    currentGame = SnakeEngine.createGame(maps[i], msg.options || {});
    var r = runOnce(py, msg.code, lineLimit, '');
    runs.push({
      map: i,
      status: r.status,
      error: r.status === 'error' ? r : null,
      crashLine: r.status === 'crash' ? r.line : null,
      output: r.output,
      timeline: currentGame.timeline,
      result: currentGame.result()
    });
    currentGame = null;
    // No point testing other maps if the code itself is broken.
    if (r.status === 'error') break;
  }
  self.postMessage({ type: 'result', id: msg.id, runs: runs, analysis: analysis });
};
