from pathlib import Path
p=Path('scripts/browser/camera-playtest-task.mjs');s=p.read_text()
# The previous scripted straight line from z=-1 intersected the actual table at
# (.7,0). Use the free door-side aisle; do not change furniture, collision or game.
a="life.position={x:0,z:-1};await boot(page,life);"
assert a in s
s=s.replace(a,"life.position={x:0,z:.9};life.yaw=0;await boot(page,life);await frames(page,16);")
a="await walkTo(page,{x:0,z:0},{steps:18,tolerance:.6});"
assert a in s
s=s.replace(a,"await walkTo(page,{x:0,z:.9},{steps:24,tolerance:.2});")
p.write_text(s)
