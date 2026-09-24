/*
 * All worlds and levels.
 * Every level has a reference `solution` that tests/check-levels.mjs runs
 * to make sure the level can be beaten.
 */
(function (root) {
  'use strict';

  // Snippets for the hotbar (click to put code in the editor).
  var HOTBAR = {
    right: { icon: 'arrow-right', label: 'move_right()', code: 'move_right()\n' },
    left: { icon: 'arrow-left', label: 'move_left()', code: 'move_left()\n' },
    up: { icon: 'arrow-up', label: 'move_up()', code: 'move_up()\n' },
    down: { icon: 'arrow-down', label: 'move_down()', code: 'move_down()\n' },
    steps: { icon: 'boots', label: 'move_right(3)', code: 'move_right(3)\n' },
    forloop: { icon: 'loop', label: 'for loop', code: 'for i in range(3):\n    move_right()\n' },
    variable: { icon: 'box', label: 'variable', code: 'steps = 3\n' },
    print: { icon: 'sign', label: 'print()', code: 'print("Hello!")\n' },
    say: { icon: 'bubble', label: 'say()', code: 'say("Yum!")\n' },
    whileloop: { icon: 'clock', label: 'while loop', code: 'while can_move("right"):\n    move_right()\n' },
    applesleft: { icon: 'apple', label: 'apples_left()', code: 'apples_left()' },
    ifelse: { icon: 'fork', label: 'if / else', code: 'if can_move("up"):\n    move_up()\nelse:\n    move_right()\n' },
    appledir: { icon: 'compass', label: 'apple_direction()', code: 'apple_direction()' },
    move: { icon: 'arrow-right', label: 'move("right")', code: 'move("right")\n' },
    def: { icon: 'book', label: 'def function', code: 'def my_move():\n    move_right()\n    move_down()\n\nmy_move()\n' },
    list: { icon: 'chest', label: 'list', code: 'path = ["right", "down", "right"]\nfor step in path:\n    move(step)\n' }
  };

  var WORLDS = [
    { id: 1, name: 'Grassy Plains', theme: 'plains', concept: 'Commands', blurb: 'Tell the snake where to go.',
      hotbar: ['right', 'down', 'up', 'left', 'steps', 'say'] },
    { id: 2, name: 'Loop Forest', theme: 'forest', concept: 'for loops', blurb: 'Repeat code without typing it again.',
      hotbar: ['forloop', 'right', 'down', 'up', 'left', 'steps', 'say'] },
    { id: 3, name: 'Variable Desert', theme: 'desert', concept: 'Variables', blurb: 'Give a number a name, then use it.',
      hotbar: ['variable', 'print', 'forloop', 'right', 'down', 'left', 'up', 'say'] },
    { id: 4, name: 'While Snowlands', theme: 'snow', concept: 'while loops', blurb: 'Keep going until something changes.',
      hotbar: ['whileloop', 'applesleft', 'forloop', 'right', 'down', 'up', 'left', 'print', 'say'] },
    { id: 5, name: 'If Island', theme: 'beach', concept: 'if / else', blurb: 'Let the snake make choices.',
      hotbar: ['ifelse', 'appledir', 'move', 'whileloop', 'applesleft', 'right', 'left', 'up', 'down'] },
    { id: 6, name: 'Function Woods', theme: 'darkforest', concept: 'Functions', blurb: 'Make your own commands with def.',
      hotbar: ['def', 'ifelse', 'whileloop', 'move', 'right', 'down', 'up', 'left', 'applesleft'] },
    { id: 7, name: 'List Lake', theme: 'ice', concept: 'Lists', blurb: 'Keep many things in one box.',
      hotbar: ['list', 'move', 'forloop', 'right', 'down', 'up', 'left', 'print', 'variable'] },
    { id: 8, name: 'Lava Mountain', theme: 'lava', concept: 'Boss levels', blurb: 'Use everything you learned!',
      hotbar: ['whileloop', 'ifelse', 'def', 'list', 'move', 'appledir', 'applesleft', 'forloop', 'say'] }
  ];

  var REQUIRE_LABELS = {
    'for': 'a for loop',
    'while': 'a while loop',
    'if': 'an if',
    'elif': 'an elif',
    'else': 'an else',
    'def': 'your own function (def)',
    'parameter': 'a function with a parameter',
    'return': 'return',
    'list': 'a list [ ]',
    'variable': 'a variable',
    'call:print': 'print()',
    'call:apples_left': 'apples_left()',
    'call:apple_direction': 'apple_direction()',
    'call:len': 'len()',
    'call:move': 'move()'
  };

  var LEVELS = [
    // ---------------- World 1: Grassy Plains ----------------
    {
      id: 1, world: 1, title: 'Hello, Snake!',
      goal: 'Eat the apple. It is 3 blocks to the right.',
      lesson: '<p>This is <b>Pip</b>, your snake. Pip only moves when you give an order in <b>Python</b>.</p>' +
        '<p><code>move_right()</code> moves Pip <b>one block</b> to the right. Write it once for every block.</p>' +
        '<p>Then press <b>&#9654; Run</b>!</p>',
      example: 'move_right()\nmove_right()',
      starter: '# Pip needs 3 moves to reach the apple\nmove_right()\n',
      hints: ['You need move_right() three times, each on its own line.', 'Don’t forget the brackets: move_right()'],
      solution: 'move_right()\nmove_right()\nmove_right()\n',
      par: 3,
      maps: [[
        '..T.....',
        '.S..A.R.',
        '....T...'
      ]]
    },
    {
      id: 2, world: 1, title: 'Around the Corner',
      goal: 'Go right, then down to the apple.',
      lesson: '<p>Pip can move in 4 directions:</p>' +
        '<p><code>move_right()</code> <code>move_left()</code><br><code>move_up()</code> <code>move_down()</code></p>' +
        '<p>Python runs your code <b>from top to bottom</b>, one line at a time.</p>',
      example: 'move_right()\nmove_down()',
      starter: 'move_right()\n',
      hints: ['Count the blocks: 3 to the right, then 2 down.', 'Write move_right() 3 times, then move_down() 2 times.'],
      solution: 'move_right()\nmove_right()\nmove_right()\nmove_down()\nmove_down()\n',
      par: 5,
      maps: [[
        '#######',
        '#S..A##',
        '####.##',
        '####A##',
        '#######'
      ]]
    },
    {
      id: 3, world: 1, title: 'Big Steps',
      goal: 'Reach the apple using only 3 lines of code.',
      lesson: '<p>Put a <b>number</b> inside the brackets to move many blocks at once!</p>' +
        '<p><code>move_right(5)</code> moves 5 blocks right.</p>' +
        '<p>The number inside the brackets is called an <b>argument</b>.</p>',
      example: 'move_right(5)\nmove_up(2)',
      starter: 'move_right(5)\n',
      hints: ['Right 5, then up 2, then right 2.', 'move_right(5)\nmove_up(2)\nmove_right(2)'],
      solution: 'move_right(5)\nmove_up(2)\nmove_right(2)\n',
      par: 3,
      maps: [[
        '##########',
        '######..A#',
        '######.###',
        '#S....A###',
        '##########'
      ]]
    },

    // ---------------- World 2: Loop Forest ----------------
    {
      id: 4, world: 2, title: 'Repeat, Repeat!',
      goal: 'Eat all the apples in the row. Use a for loop.',
      lesson: '<p>Typing the same line again and again is boring. A <b>for loop</b> repeats it for you!</p>' +
        '<p>The lines <b>inside</b> the loop start with <b>4 spaces</b>. Don’t forget the <b>colon :</b> at the end of the first line.</p>',
      example: 'for i in range(3):\n    move_right()',
      starter: 'for i in range(3):\n    move_right()\n',
      hints: ['There are 10 blocks to the end.', 'Change range(3) into range(10).'],
      solution: 'for i in range(10):\n    move_right()\n',
      requires: ['for'], par: 2,
      maps: [[
        'TTTTTTTTTTTT',
        'TS.A.A.A.A.A',
        'TTTTTTTTTTTT'
      ]]
    },
    {
      id: 5, world: 2, title: 'Stairs',
      goal: 'Climb down the stairs and eat every apple.',
      lesson: '<p>A loop can repeat <b>more than one line</b>. Every line that has 4 spaces in front belongs to the loop.</p>',
      example: 'for i in range(2):\n    move_right()\n    move_down()',
      starter: 'for i in range(2):\n    move_right()\n    move_down()\n',
      hints: ['Each stair is: right one, then down one.', 'There are 6 stairs, so use range(6).'],
      solution: 'for i in range(6):\n    move_right()\n    move_down()\n',
      requires: ['for'], par: 3,
      maps: [[
        'S...T...',
        '.A...T..',
        '..A...T.',
        'T..A....',
        '....A..T',
        '..T..A..',
        'T.....A.',
        '...T....'
      ]]
    },
    {
      id: 6, world: 2, title: 'Zig-Zag Garden',
      goal: 'Go down and up the garden rows. Eat all 7 apples.',
      lesson: '<p>Look for the <b>pattern</b>. Pip goes: down 3, right 1, up 3, right 1... and then again!</p>' +
        '<p>Put the whole pattern inside a loop.</p>',
      example: 'for i in range(2):\n    move_down(3)\n    move_right()',
      starter: 'for i in range(3):\n    move_down(3)\n    move_right()\n',
      hints: ['The pattern is: move_down(3), move_right(), move_up(3), move_right()', 'Repeat the pattern 3 times.'],
      solution: 'for i in range(3):\n    move_down(3)\n    move_right()\n    move_up(3)\n    move_right()\n',
      requires: ['for'], par: 5,
      maps: [[
        'TTTTTTTTT',
        'TSA.A.AAT',
        'T.......T',
        'T.......T',
        'TA.A.A..T',
        'TTTTTTTTT'
      ]]
    },
    {
      id: 7, world: 2, title: 'Mountain Stairs',
      goal: 'Climb the big stairs up to the top apple.',
      lesson: '<p>Loops and big steps work great together!</p>' +
        '<p>Each stair here is <b>3 blocks wide</b> and <b>2 blocks tall</b>.</p>',
      example: 'for i in range(2):\n    move_right(3)\n    move_up(2)',
      starter: 'for i in range(1):\n    move_right(3)\n',
      hints: ['Inside the loop: move_right(3) and move_up(2).', 'There are 4 stairs.'],
      solution: 'for i in range(4):\n    move_right(3)\n    move_up(2)\n',
      requires: ['for'], par: 3,
      maps: [[
        '..T...T.....A',
        'T........T...',
        '....T....A...',
        '.T..........T',
        '..T...A......',
        '..........T..',
        '...A....T..T.',
        '......T......',
        'S......T...T.'
      ]]
    },

    // ---------------- World 3: Variable Desert ----------------
    {
      id: 8, world: 3, title: 'Name a Number',
      goal: 'Make a U shape around the cactus patch. Use a variable.',
      lesson: '<p>A <b>variable</b> is a box with a name that keeps a value.</p>' +
        '<p><code>steps = 4</code> puts the number 4 in a box called <b>steps</b>.</p>' +
        '<p>Now you can write <code>move_right(steps)</code>. If you change the box, every move changes too!</p>',
      example: 'size = 2\nmove_right(size)\nmove_down(size)',
      starter: 'steps = 4\nmove_right(steps)\n',
      hints: ['Pip goes right 4, down 4, then left 4.', 'Use move_down(steps) and move_left(steps).'],
      solution: 'steps = 4\nmove_right(steps)\nmove_down(steps)\nmove_left(steps)\n',
      requires: ['variable'], par: 4,
      maps: [[
        '..C...C',
        '.S.A.A.',
        '..CCC..',
        '..C.C.C',
        '..CCC..',
        '.A.A.A.',
        'C.....C'
      ]]
    },
    {
      id: 9, world: 3, title: 'Growing Steps',
      goal: 'Each stair is one bigger than the last. Eat all the apples!',
      lesson: '<p>A variable can <b>change</b>! This line makes the value in the box 1 bigger:</p>' +
        '<p><code>steps = steps + 1</code></p>' +
        '<p>Change it inside a loop and the stairs grow each time.</p>',
      example: 'steps = 1\nfor i in range(3):\n    print(steps)\n    steps = steps + 1',
      starter: 'steps = 1\nfor i in range(4):\n    move_right(steps)\n',
      hints: ['Inside the loop: move_right(steps), move_down(steps), then make steps 1 bigger.', 'steps = steps + 1'],
      solution: 'steps = 1\nfor i in range(4):\n    move_right(steps)\n    move_down(steps)\n    steps = steps + 1\n',
      requires: ['variable', 'for'], par: 5,
      maps: [[
        'SA...C...C.',
        '.A.A...C...',
        'C........C.',
        '.C.A..A....',
        '...C.....C.',
        'C..........',
        '..C...A...A',
        '.....C.....',
        '.C......C..',
        '....C......',
        '.......C..A'
      ]]
    },
    {
      id: 10, world: 3, title: 'Count and Print',
      goal: 'Walk 6 steps with a loop. Count them in a variable, then print the count.',
      lesson: '<p><code>print()</code> shows a message in the <b>Output</b> box.</p>' +
        '<p>Make a counter that starts at 0 and gets 1 bigger every step:</p>',
      example: 'count = 0\ncount = count + 1\nprint(count)',
      starter: 'count = 0\nfor i in range(6):\n    move_right()\n\nprint(count)\n',
      hints: ['Inside the loop, add: count = count + 1', 'Make sure print(count) is NOT inside the loop (no spaces in front).'],
      solution: 'count = 0\nfor i in range(6):\n    move_right()\n    count = count + 1\nprint(count)\n',
      requires: ['variable', 'for', 'call:print'], par: 5,
      expectOutput: '6',
      maps: [[
        '..C...C..',
        '.SAAAAAA.',
        'C...C...C'
      ]]
    },

    // ---------------- World 4: While Snowlands ----------------
    {
      id: 11, world: 4, title: 'Until the Wall',
      goal: 'Go right until you can’t. The path is a different size each time!',
      lesson: '<p>Sometimes you don’t know how many steps you need. A <b>while loop</b> keeps going <b>while</b> something is <b>True</b>.</p>' +
        '<p><code>can_move("right")</code> is <b>True</b> if nothing is blocking Pip on the right.</p>',
      example: 'while can_move("right"):\n    move_right()',
      starter: '# This level has 3 different maps!\nmove_right(4)\n',
      hints: ['move_right(4) only works for the short path.', 'while can_move("right"):\n    move_right()'],
      solution: 'while can_move("right"):\n    move_right()\n',
      requires: ['while'], par: 2,
      maps: [
        ['TTTTTTT', 'TS...AT', 'TTTTTTT'],
        ['TTTTTTTTTTT', 'TS.......AT', 'TTTTTTTTTTT'],
        ['TTTTTTTTTTTTTT', 'TS..........AT', 'TTTTTTTTTTTTTT']
      ]
    },
    {
      id: 12, world: 4, title: 'Apple Counter',
      goal: 'Go down while there are apples left.',
      lesson: '<p><code>apples_left()</code> tells you how many apples are still on the map.</p>' +
        '<p>Compare numbers with <code>&gt;</code> (bigger than) and <code>&lt;</code> (smaller than):</p>',
      example: 'while apples_left() > 0:\n    move_down()',
      starter: 'print(apples_left())\n',
      hints: ['Loop while apples_left() > 0', 'Inside the loop, move_down()'],
      solution: 'while apples_left() > 0:\n    move_down()\n',
      requires: ['while', 'call:apples_left'], par: 2,
      maps: [
        ['TST', 'TAT', 'T.T', 'TAT', 'TAT', 'T.T', 'T.T', 'T.T'],
        ['TST', 'T.T', 'TAT', 'TAT', 'TAT', 'T.T', 'TAT', 'TAT']
      ]
    },
    {
      id: 13, world: 4, title: 'Up and Over',
      goal: 'Go up as far as you can, then right as far as you can.',
      lesson: '<p>You can use <b>two while loops</b>, one after the other.</p>' +
        '<p>The first loop finishes before the second one starts.</p>',
      example: 'while can_move("up"):\n    move_up()',
      starter: 'while can_move("up"):\n    move_up()\n',
      hints: ['After the first loop, add a second loop for going right.', 'The second loop has no spaces in front of "while".'],
      solution: 'while can_move("up"):\n    move_up()\nwhile can_move("right"):\n    move_right()\n',
      requires: ['while'], par: 4,
      maps: [
        ['#######', '#....A#', '#A#####', '#.#####', '#S#####', '#######'],
        ['##########', '#...A...A#', '#.########', '#S########', '##########'],
        ['#####', '#..A#', '#.###', '#A###', '#.###', '#.###', '#S###', '#####']
      ]
    },

    // ---------------- World 5: If Island ----------------
    {
      id: 14, world: 5, title: 'Left or Right?',
      goal: 'The apple is left OR right. Check before you move!',
      lesson: '<p>An <b>if</b> lets Pip make a choice. <code>apple_direction()</code> gives the direction of the nearest apple, like <code>"left"</code>.</p>' +
        '<p>Use <b>==</b> (two equal signs) to check if two things are the same.</p>',
      example: 'if apple_direction() == "up":\n    move_up()\nelse:\n    move_down()',
      starter: 'if apple_direction() == "right":\n    move_right(3)\n',
      hints: ['Add an else: part for when the apple is on the left.', 'else:\n    move_left(3)'],
      solution: 'if apple_direction() == "right":\n    move_right(3)\nelse:\n    move_left(3)\n',
      requires: ['if', 'else'], par: 4,
      maps: [
        ['WWWWWWW', '...S..A', 'WWWWWWW'],
        ['WWWWWWW', 'A..S...', 'WWWWWWW']
      ]
    },
    {
      id: 15, world: 5, title: 'Rock Hopping',
      goal: 'Rocks block the path! Go around them to eat every apple.',
      lesson: '<p>Use <b>elif</b> ("else if") to check more than one thing:</p>' +
        '<p>Python checks from the top and does the <b>first</b> one that is True.</p>',
      example: 'if can_move("right"):\n    move_right()\nelif can_move("up"):\n    move_up()\nelse:\n    move_down()',
      starter: 'while apples_left() > 0:\n    if can_move("right"):\n        move_right()\n',
      hints: ['If Pip can’t go right, try up. If Pip can’t go up either, go down.', 'Add: elif can_move("up"): move_up() and else: move_down()'],
      solution: 'while apples_left() > 0:\n    if can_move("right"):\n        move_right()\n    elif can_move("up"):\n        move_up()\n    else:\n        move_down()\n',
      requires: ['while', 'if', 'elif'], par: 7,
      maps: [
        ['WWWWWWWWWW', '....A.#...', 'S..#.....A', 'WWWWWWWWWW'],
        ['WWWWWWWWWWWW', '.....#..A...', 'S.A#....#..A', 'WWWWWWWWWWWW']
      ]
    },
    {
      id: 16, world: 5, title: 'Smart Snake',
      goal: 'Follow your nose! Always move toward the nearest apple.',
      lesson: '<p><code>move("left")</code> moves in the direction you give it in quotes.</p>' +
        '<p><code>apple_direction()</code> gives back a direction, so you can put it straight inside <code>move()</code>!</p>',
      example: 'where = apple_direction()\nmove(where)',
      starter: 'while apples_left() > 0:\n    print(apple_direction())\n    move_right()\n',
      hints: ['Instead of move_right(), move toward the apple.', 'move(apple_direction())'],
      solution: 'while apples_left() > 0:\n    move(apple_direction())\n',
      requires: ['while', 'call:apple_direction'], par: 2,
      maps: [
        ['WWWWWWWW', 'WS.A...W', 'W.....AW', 'W..A...W', 'W......W', 'WWWWWWWW'],
        ['WWWWWWWWW', 'W.......W', 'WS...A..W', 'W......AW', 'W.A.....W', 'WWWWWWWWW']
      ]
    },

    // ---------------- World 6: Function Woods ----------------
    {
      id: 17, world: 6, title: 'My First Function',
      goal: 'Make a zigzag function, then use it 3 times.',
      lesson: '<p>With <b>def</b> you can make your <b>own</b> command, called a <b>function</b>.</p>' +
        '<p>The lines inside are pushed in with 4 spaces. They only run when you <b>call</b> the function by name.</p>',
      example: 'def jump():\n    move_up()\n    move_down()\n\njump()\njump()',
      starter: 'def zigzag():\n    move_right()\n    move_down()\n\nzigzag()\n',
      hints: ['One zigzag is: right, down, right, up.', 'Call zigzag() three times at the bottom.'],
      solution: 'def zigzag():\n    move_right()\n    move_down()\n    move_right()\n    move_up()\n\nzigzag()\nzigzag()\nzigzag()\n',
      requires: ['def'], par: 8,
      maps: [[
        'TTTTTTTTT',
        'TS.A.A.AT',
        'T.A.A.A.T',
        'TTTTTTTTT'
      ]]
    },
    {
      id: 18, world: 6, title: 'Hop Over',
      goal: 'Hop over the walls. Each wall is a different size!',
      lesson: '<p>A function can have a <b>parameter</b>. It’s a variable you fill in when you call the function.</p>' +
        '<p><code>hop(2)</code> puts 2 into <b>n</b>.</p>',
      example: 'def hop(n):\n    move_up()\n    move_right(n)\n    move_down()',
      starter: 'def hop(n):\n    move_up()\n    move_right(n)\n    move_down()\n\nmove_right()\nhop(2)\n',
      hints: ['After each hop, move_right() once to reach the next wall.', 'The hops are: hop(2), hop(3), hop(4)'],
      solution: 'def hop(n):\n    move_up()\n    move_right(n)\n    move_down()\n\nmove_right()\nhop(2)\nmove_right()\nhop(3)\nmove_right()\nhop(4)\nmove_right()\n',
      requires: ['def', 'parameter'], par: 11,
      maps: [[
        '..............',
        'S.#A.##A.###AA',
        'TTTTTTTTTTTTTT'
      ]]
    },
    {
      id: 19, world: 6, title: 'Give It Back',
      goal: 'Write a function that returns which way to go.',
      lesson: '<p>A function can send an answer back with <b>return</b>.</p>' +
        '<p>Here, <code>next_step()</code> returns <code>"right"</code> if the way right is free, and <code>"down"</code> if it isn’t.</p>',
      example: 'def favourite():\n    return "up"\n\nmove(favourite())',
      starter: 'def next_step():\n    if can_move("right"):\n        return "right"\n\nwhile apples_left() > 0:\n    move(next_step())\n',
      hints: ['When Pip can’t go right, the function should return "down".', 'Add return "down" at the end of the function (4 spaces in).'],
      solution: 'def next_step():\n    if can_move("right"):\n        return "right"\n    return "down"\n\nwhile apples_left() > 0:\n    move(next_step())\n',
      requires: ['def', 'return'], par: 7,
      maps: [
        ['#########', '#S..#####', '###.#####', '###A..###', '#####.###', '#####..A#', '#########'],
        ['##########', '#S.#######', '##.#######', '##A#######', '##....####', '#####.####', '#####...A#', '##########']
      ]
    },

    // ---------------- World 7: List Lake ----------------
    {
      id: 20, world: 7, title: 'Follow the List',
      goal: 'Put the path in a list, then loop over it.',
      lesson: '<p>A <b>list</b> keeps many things in order, inside <b>[ ]</b> with commas between them.</p>' +
        '<p><code>for step in path:</code> takes each thing from the list, one by one.</p>',
      example: 'path = ["right", "down"]\nfor step in path:\n    move(step)',
      starter: 'path = ["right", "right", "down"]\nfor step in path:\n    move(step)\n',
      hints: ['Look at the ice path: right 2, down 2, right 3, up 1.', 'path = ["right", "right", "down", "down", "right", "right", "right", "up"]'],
      solution: 'path = ["right", "right", "down", "down", "right", "right", "right", "up"]\nfor step in path:\n    move(step)\n',
      requires: ['list', 'for'], par: 3,
      maps: [[
        'WWWWWWWW',
        'WS.AWWWW',
        'WWW.WWAW',
        'WWWA..AW',
        'WWWWWWWW'
      ]]
    },
    {
      id: 21, world: 7, title: 'Number List',
      goal: 'The treasure map says: 4, 2, 3, 1. Go right that many, then down 1, each time.',
      lesson: '<p>Lists can keep <b>numbers</b> too!</p>' +
        '<p>Each time round the loop, <b>n</b> is the next number from the list.</p>',
      example: 'numbers = [1, 2, 3]\nfor n in numbers:\n    print(n)',
      starter: 'jumps = [4, 2, 3, 1]\nfor n in jumps:\n    print(n)\n',
      hints: ['Inside the loop: move_right(n) then move_down()', 'Change print(n) into move_right(n) and add move_down()'],
      solution: 'jumps = [4, 2, 3, 1]\nfor n in jumps:\n    move_right(n)\n    move_down()\n',
      requires: ['list', 'for'], par: 4,
      maps: [[
        'S....WWWWWW',
        'WWWWA..WWWW',
        'WWWWWWA...W',
        'WWWWWWWWWA.',
        'WWWWWWWWWWA'
      ]]
    },
    {
      id: 22, world: 7, title: 'Two Lists',
      goal: 'Use one list for directions and one for steps.',
      lesson: '<p>Every item in a list has a <b>position</b> number. Counting starts at <b>0</b>!</p>' +
        '<p><code>len(things)</code> tells you how many items are in a list.</p>' +
        '<p><code>move("down", 2)</code> moves 2 blocks down.</p>',
      example: 'colors = ["red", "blue"]\nprint(colors[0])\nprint(len(colors))',
      starter: 'directions = ["right", "down", "right", "up", "right"]\nsteps = [3, 2, 2, 2, 3]\n\nfor i in range(len(directions)):\n    print(directions[i], steps[i])\n',
      hints: ['directions[i] is the direction and steps[i] is how far.', 'move(directions[i], steps[i])'],
      solution: 'directions = ["right", "down", "right", "up", "right"]\nsteps = [3, 2, 2, 2, 3]\n\nfor i in range(len(directions)):\n    move(directions[i], steps[i])\n',
      requires: ['list', 'call:len'], par: 4,
      maps: [[
        'WWWWWWWWWWW',
        'W...WW....W',
        'W.W....W..W',
        'WS..A.A..AW',
        'W..W.W.W..W',
        'W...A.A...W',
        'WWWWWWWWWWW'
      ]]
    },

    // ---------------- World 8: Lava Mountain ----------------
    {
      id: 23, world: 8, title: 'Maze Runner',
      goal: 'Find the way through the maze. Every map is different!',
      lesson: '<p>Pip can’t go backwards into its own body, so in a narrow tunnel there is <b>only one way</b> to go.</p>' +
        '<p>Check each direction with <b>if / elif / else</b> inside a <b>while</b> loop.</p>',
      example: 'while apples_left() > 0:\n    if can_move("right"):\n        move_right()\n    elif can_move("down"):\n        move_down()',
      starter: 'while apples_left() > 0:\n    if can_move("right"):\n        move_right()\n    elif can_move("down"):\n        move_down()\n',
      hints: ['Add another elif for "up".', 'If right, down and up are all blocked, the only way left is... left! Use else.'],
      solution: 'while apples_left() > 0:\n    if can_move("right"):\n        move_right()\n    elif can_move("down"):\n        move_down()\n    elif can_move("up"):\n        move_up()\n    else:\n        move_left()\n',
      requires: ['while', 'if', 'elif'], par: 9,
      maps: [
        ['##########', '#S..A###A#', '####.###.#', '#A...###.#', '#.######.#', '#...A....#', '##########'],
        ['#########', '#..A..A##', '#.####.##', '#.##A..##', '#.##.####', '#S##...A#', '#########']
      ]
    },
    {
      id: 24, world: 8, title: 'The Final Feast',
      goal: 'Eat every apple on the lava mountain. Watch out for rocks!',
      lesson: '<p>This is the <b>boss level</b>! Put everything together:</p>' +
        '<p>&bull; a <b>function</b> that picks a safe direction<br>&bull; an <b>if</b> to check if the apple way is free<br>&bull; a <b>list</b> of other ways to try<br>&bull; a <b>while</b> loop until the apples are gone</p>',
      example: 'def pick():\n    d = apple_direction()\n    if can_move(d):\n        return d\n    for other in ["up", "right", "down", "left"]:\n        if can_move(other):\n            return other',
      starter: 'def pick():\n    d = apple_direction()\n    if can_move(d):\n        return d\n    return "up"\n\nwhile apples_left() > 0:\n    move(pick())\n',
      hints: ['When the apple way is blocked, try every direction from a list.', 'for other in ["up", "right", "down", "left"]:\n    if can_move(other):\n        return other'],
      solution: 'def pick():\n    d = apple_direction()\n    if can_move(d):\n        return d\n    for other in ["up", "right", "down", "left"]:\n        if can_move(other):\n            return other\n\nwhile apples_left() > 0:\n    move(pick())\n',
      requires: ['def', 'if', 'while', 'list'], par: 10,
      maps: [
        ['LLLLLLLLLL', 'L........L', 'L.S..A...L', 'L...##...L', 'L.A.#..A.L', 'L......A.L', 'L..A.....L', 'LLLLLLLLLL'],
        ['LLLLLLLLLLL', 'L.A.......L', 'L...#.....L', 'L.S.#.A...L', 'L...###...L', 'L......A..L', 'L.A......AL', 'LLLLLLLLLLL']
      ]
    }
  ];

  var FREE_PLAY = {
    id: 'free', world: 1, title: 'Free Play',
    goal: 'A big field with random apples. Write any code you like!',
    lesson: '<p>No rules here! Try loops, ifs and functions. Every run puts the apples in new places.</p>' +
      '<p>Commands: <code>move_right()</code> <code>move_left()</code> <code>move_up()</code> <code>move_down()</code> ' +
      '<code>move("up", 2)</code> <code>can_move("left")</code> <code>apples_left()</code> <code>apple_direction()</code> <code>say("hi")</code> <code>print()</code></p>',
    example: 'while apples_left() > 0:\n    move(apple_direction())',
    starter: '# Try anything!\nsay("Let\'s go!")\nfor i in range(5):\n    move_right()\n',
    hints: ['Try: while apples_left() > 0: move(apple_direction())'],
    free: true,
    maps: [[
      '................',
      '..T.........R...',
      '................',
      '.....WW.........',
      '.....WW.....T...',
      '..S.............',
      '................',
      '.........T......',
      '...R............',
      '............T...',
      '................'
    ]]
  };

  root.GameData = {
    HOTBAR: HOTBAR,
    WORLDS: WORLDS,
    LEVELS: LEVELS,
    FREE_PLAY: FREE_PLAY,
    REQUIRE_LABELS: REQUIRE_LABELS
  };
})(typeof self !== 'undefined' ? self : this);
