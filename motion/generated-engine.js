(function () {
    "use strict";

    var Motion = window.MotionExtended;
    var Data = window.MotionFieldData;
    var h = Motion.helpers;
    var TAU = Math.PI * 2;

    function makeRandom(seed) {
        return function () {
            seed |= 0;
            seed = seed + 0x6D2B79F5 | 0;
            var value = Math.imul(seed ^ seed >>> 15, 1 | seed);
            value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
            return ((value ^ value >>> 14) >>> 0) / 4294967296;
        };
    }

    function rgba(hex, alpha) {
        var value = hex.replace("#", "");
        if (value.length === 3) value = value.split("").map(function (part) { return part + part; }).join("");
        return "rgba(" + parseInt(value.slice(0, 2), 16) + "," + parseInt(value.slice(2, 4), 16) + "," + parseInt(value.slice(4, 6), 16) + "," + alpha + ")";
    }

    function createState(api, definition) {
        var ctx = api.useCanvas("#050817");
        var random = makeRandom(definition.seed);
        return {
            api: api,
            def: definition,
            ctx: ctx,
            random: random,
            accent: definition.palette[0],
            secondary: definition.palette[1],
            pointer: { x: 0.5, y: 0.5, px: 0, py: 0, down: false, pressure: 0.5 },
            pulses: [{ x: 0.32, y: 0.46, born: performance.now() - 500 }],
            strokes: [],
            particles: [],
            nodes: [],
            trails: [],
            cells: null,
            buffer: null,
            bufferContext: null,
            compositionBuffer: null,
            compositionContext: null,
            scroll: 0,
            velocity: 0,
            preset: 0,
            frameCount: 0,
            lastStep: 0,
            dirty: true
        };
    }

    function setCanvasFont(ctx, weight, size, family) {
        ctx.font = weight + " " + size + "px " + (family || "Inter, Segoe UI, sans-serif");
    }

    function begin(state, now, fade) {
        var ctx = state.ctx;
        var width = state.api.size.width;
        var height = state.api.size.height;
        if (fade) {
            ctx.fillStyle = "rgba(5,8,23," + fade + ")";
            ctx.fillRect(0, 0, width, height);
        } else {
            ctx.fillStyle = "#050817";
            ctx.fillRect(0, 0, width, height);
        }
        var glow = ctx.createRadialGradient(state.pointer.x * width, state.pointer.y * height, 0, state.pointer.x * width, state.pointer.y * height, Math.max(width, height) * 0.65);
        glow.addColorStop(0, rgba(state.accent, 0.1));
        glow.addColorStop(0.5, rgba(state.secondary, 0.035));
        glow.addColorStop(1, "rgba(5,8,23,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
        if (state.def.recipeIndex === 2) drawStrokes(state);
        if (state.def.recipeIndex === 4) drawPanelDividers(state);
    }

    function drawPanelDividers(state) {
        var ctx = state.ctx;
        var width = state.api.size.width;
        var height = state.api.size.height;
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,.12)";
        ctx.lineWidth = 1;
        [1 / 3, 2 / 3].forEach(function (part) {
            ctx.beginPath(); ctx.moveTo(width * part, height * 0.08); ctx.lineTo(width * part, height * 0.92); ctx.stroke();
        });
        ctx.restore();
    }

    function drawStrokes(state) {
        var ctx = state.ctx;
        ctx.save();
        ctx.lineWidth = 10;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = rgba(state.secondary, 0.24);
        state.strokes.forEach(function (stroke) {
            if (stroke.length < 2) return;
            ctx.beginPath();
            stroke.forEach(function (point, index) {
                var x = point.x * state.api.size.width;
                var y = point.y * state.api.size.height;
                if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });
        ctx.restore();
    }

    function pulseValue(state, x, y, now, speed) {
        var value = 0;
        state.pulses.forEach(function (pulse) {
            var age = (now - pulse.born) * 0.001;
            var distance = Math.hypot(x - pulse.x, y - pulse.y);
            value += Math.sin((distance * 24 - age * (speed || 8)) * Math.PI) * Math.exp(-distance * 3.6) * Math.exp(-age * 0.18);
        });
        return value;
    }

    function syntheticInput(state, now) {
        if (!(state.api.isPreview || state.def.recipeIndex === 4)) return;
        var offset = state.def.algorithmIndex * 0.73 + state.def.familyIndex * 0.19;
        state.pointer.x = 0.5 + Math.cos(now * 0.00047 + offset) * 0.29;
        state.pointer.y = 0.5 + Math.sin(now * 0.00061 + offset) * 0.27;
        state.pointer.px = state.pointer.x * state.api.size.width;
        state.pointer.py = state.pointer.y * state.api.size.height;
        if (state.api.isPreview && state.def.recipeIndex === 3) state.scroll = 0.5 - 0.5 * Math.cos(now * 0.00048 + offset);
        if (state.api.isPreview && state.def.recipeIndex === 2 && !state.strokes.length) {
            state.strokes.push(Array.from({ length: 48 }, function (_, index) {
                var angle = index / 47 * TAU;
                return { x: 0.5 + Math.cos(angle) * (0.2 + 0.045 * Math.sin(angle * 3)), y: 0.5 + Math.sin(angle) * (0.18 + 0.035 * Math.cos(angle * 2)) };
            }));
        }
        if (now - state.lastStep > 1700) {
            state.pulses.push({ x: state.pointer.x, y: state.pointer.y, born: now });
            state.pulses = state.pulses.slice(-8);
            state.lastStep = now;
        }
    }

    function commonPointer(state, type, point) {
        Object.assign(state.pointer, point);
        state.pointer.down = type === "down" || (type === "move" && point.pressure > 0);
        if (type === "down") {
            state.pulses.push({ x: point.x, y: point.y, born: performance.now() });
            state.pulses = state.pulses.slice(-10);
            if (state.def.recipeIndex === 2) state.strokes.push([{ x: point.x, y: point.y }]);
        }
        if (type === "move" && state.def.recipeIndex === 2 && state.pointer.down) {
            var current = state.strokes[state.strokes.length - 1];
            if (current) current.push({ x: point.x, y: point.y });
        }
        if (type === "up" || type === "cancel") state.pointer.down = false;
        state.dirty = true;
    }

    function commonAction(state) {
        state.preset = (state.preset + 1) % 4;
        state.pulses.push({ x: 0.2 + state.random() * 0.6, y: 0.2 + state.random() * 0.6, born: performance.now() });
        state.strokes = [];
        state.dirty = true;
        state.api.setState("PRESET / " + String(state.preset + 1).padStart(2, "0"));
    }

    function drawOscillatory(state, now) {
        begin(state, now);
        var ctx = state.ctx, width = state.api.size.width, height = state.api.size.height;
        var mode = state.def.algorithmIndex;
        var phase = now * 0.0016 + state.scroll * 9 + state.preset * 0.7;
        if (mode === 0) {
            for (var row = 0; row < 13; row += 1) {
                ctx.beginPath();
                for (var step = 0; step <= 160; step += 1) {
                    var x = step / 160;
                    var proximity = Math.exp(-Math.pow((x - state.pointer.x) * 8, 2));
                    var wave = Math.sin(x * TAU * (2 + state.preset * 0.25) - phase + row * 0.38) * 0.018;
                    wave += proximity * (state.pointer.y - 0.5) * 0.18 + pulseValue(state, x, row / 12, now, 6) * 0.012;
                    var px = x * width, py = (0.14 + row * 0.06 + wave) * height;
                    if (!step) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.strokeStyle = row % 3 === 0 ? state.accent : rgba(state.secondary, 0.38);
                ctx.lineWidth = row % 3 === 0 ? 2 : 1;
                ctx.stroke();
            }
        } else if (mode === 1) {
            var columns = state.api.isPreview ? 24 : 38, rows = state.api.isPreview ? 14 : 22;
            for (var y = 0; y < rows; y += 1) for (var xIndex = 0; xIndex < columns; xIndex += 1) {
                var nx = xIndex / (columns - 1), ny = y / (rows - 1);
                var displacement = Math.sin(Math.hypot(nx - state.pointer.x, ny - state.pointer.y) * 34 - phase * 5) * 0.5 + pulseValue(state, nx, ny, now, 8) * 0.7;
                var radius = Math.max(0.2, 1.2 + (displacement + 1) * 2.1);
                ctx.fillStyle = displacement > 0 ? rgba(state.accent, 0.35 + displacement * 0.35) : rgba(state.secondary, 0.26);
                ctx.beginPath(); ctx.arc(nx * width, ny * height, radius, 0, TAU); ctx.fill();
            }
        } else if (mode === 2) {
            var count = state.api.isPreview ? 90 : 160;
            for (var index = 0; index < count; index += 1) {
                var baseAngle = index / count * TAU;
                var coupling = Math.sin(phase * 1.4 + index * 0.21) * (0.3 + state.pointer.x * 0.7);
                var radiusRing = Math.min(width, height) * (0.22 + 0.09 * Math.sin(index * 0.37 + phase));
                var cx = width * 0.5 + Math.cos(baseAngle + coupling) * radiusRing;
                var cy = height * 0.5 + Math.sin(baseAngle + coupling) * radiusRing;
                ctx.strokeStyle = rgba(state.accent, 0.1);
                ctx.beginPath(); ctx.moveTo(width * 0.5, height * 0.5); ctx.lineTo(cx, cy); ctx.stroke();
                ctx.fillStyle = index % 7 === 0 ? state.secondary : state.accent;
                ctx.beginPath(); ctx.arc(cx, cy, index % 7 === 0 ? 4 : 2, 0, TAU); ctx.fill();
            }
        } else {
            ctx.save(); ctx.translate(width * 0.5, height * 0.5);
            for (var band = 0; band < 8; band += 1) {
                ctx.beginPath();
                for (var point = 0; point <= 360; point += 1) {
                    var a = point / 360 * TAU;
                    var mx = Math.sin(a * (2 + band % 3) + phase * (0.6 + band * 0.05));
                    var my = Math.sin(a * (3 + band % 4) - phase * 0.5);
                    var radiusMode = Math.min(width, height) * (0.18 + band * 0.018);
                    var dx = mx * radiusMode * (0.65 + state.pointer.x * 0.45);
                    var dy = my * radiusMode * (0.65 + state.pointer.y * 0.45);
                    if (!point) ctx.moveTo(dx, dy); else ctx.lineTo(dx, dy);
                }
                ctx.strokeStyle = band % 2 ? rgba(state.secondary, 0.32) : rgba(state.accent, 0.48);
                ctx.lineWidth = 1.2; ctx.stroke();
            }
            ctx.restore();
        }
    }

    function drawDeformable(state, now) {
        begin(state, now);
        var ctx = state.ctx, width = state.api.size.width, height = state.api.size.height;
        var mode = state.def.algorithmIndex, t = now * 0.001;
        var px = state.pointer.x * width, py = state.pointer.y * height;
        if (mode === 0 || mode === 2) {
            var cols = mode === 0 ? 18 : 11, rows = mode === 0 ? 13 : 9;
            var points = [];
            for (var y = 0; y < rows; y += 1) {
                points[y] = [];
                for (var x = 0; x < cols; x += 1) {
                    var baseX = width * (0.18 + x / (cols - 1) * 0.64);
                    var baseY = height * (0.18 + y / (rows - 1) * 0.62);
                    var dx = baseX - px, dy = baseY - py, dist = Math.hypot(dx, dy) || 1;
                    var pull = Math.exp(-dist / (Math.min(width, height) * 0.23)) * (state.pointer.down ? 0.72 : 0.24);
                    var ripple = Math.sin(t * 3 + x * 0.55 + y * 0.42) * (mode === 2 ? 12 : 4);
                    points[y][x] = { x: baseX - dx * pull + Math.sin(y + t) * 3, y: baseY - dy * pull + ripple };
                }
            }
            ctx.strokeStyle = rgba(state.accent, 0.45); ctx.lineWidth = 1;
            for (var row = 0; row < rows; row += 1) { ctx.beginPath(); points[row].forEach(function (p, i) { if (!i) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); }); ctx.stroke(); }
            for (var column = 0; column < cols; column += 1) { ctx.beginPath(); for (var ry = 0; ry < rows; ry += 1) { var p = points[ry][column]; if (!ry) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); } ctx.stroke(); }
            points.flat().forEach(function (p, index) { ctx.fillStyle = index % cols === 0 ? state.secondary : state.accent; ctx.beginPath(); ctx.arc(p.x,p.y,mode === 2 ? 3.2 : 2,0,TAU); ctx.fill(); });
        } else {
            var count = mode === 1 ? 28 : 16;
            var centerX = width * 0.56, centerY = height * 0.51;
            ctx.beginPath();
            for (var index = 0; index <= count; index += 1) {
                var angle = index / count * TAU;
                var radius = Math.min(width,height) * (mode === 1 ? 0.23 : 0.27);
                var wobble = 1 + Math.sin(angle * (mode === 1 ? 3 : 6) + t * 2.3) * 0.055;
                var ddx = px - centerX, ddy = py - centerY;
                var influence = Math.exp(-Math.abs(Math.atan2(ddy,ddx) - angle) * 1.4) * (state.pointer.down ? 0.18 : 0.05);
                var xPos = centerX + Math.cos(angle) * radius * (wobble + influence) * (mode === 3 ? 1.22 : 1);
                var yPos = centerY + Math.sin(angle) * radius * (wobble + influence) * (mode === 3 ? 0.86 : 1);
                if (!index) ctx.moveTo(xPos,yPos); else ctx.lineTo(xPos,yPos);
            }
            ctx.closePath();
            var gradient = ctx.createRadialGradient(centerX - 50,centerY - 70,0,centerX,centerY,Math.min(width,height)*.35);
            gradient.addColorStop(0,"#fff"); gradient.addColorStop(.15,state.accent); gradient.addColorStop(1,rgba(state.secondary,.35));
            ctx.fillStyle = gradient; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.72)"; ctx.lineWidth = 2; ctx.stroke();
            if (mode === 3) {
                ctx.strokeStyle = rgba(state.secondary,.38);
                for (var ring = .25; ring < 1; ring += .2) { ctx.beginPath(); ctx.ellipse(centerX,centerY,radius*ring*1.22,radius*ring*.86,0,0,TAU); ctx.stroke(); }
            }
        }
    }

    function solveChain(origin, target, lengths, bend) {
        var points = [{ x: origin.x, y: origin.y }];
        var total = lengths.reduce(function (sum, value) { return sum + value; }, 0);
        var dx = target.x - origin.x, dy = target.y - origin.y, distance = Math.hypot(dx,dy) || 1;
        var angle = Math.atan2(dy,dx);
        for (var i = 0; i < lengths.length; i += 1) {
            var progress = (i + 1) / lengths.length;
            var curve = Math.sin(progress * Math.PI) * bend * Math.min(total,distance);
            points.push({ x: origin.x + Math.cos(angle) * Math.min(distance,total) * progress - Math.sin(angle) * curve, y: origin.y + Math.sin(angle) * Math.min(distance,total) * progress + Math.cos(angle) * curve });
        }
        points[points.length - 1] = { x: target.x, y: target.y };
        for (var pass = 0; pass < 5; pass += 1) {
            points[points.length - 1] = { x: target.x, y: target.y };
            for (var back = points.length - 2; back >= 0; back -= 1) { var bdx=points[back].x-points[back+1].x,bdy=points[back].y-points[back+1].y,bd=Math.hypot(bdx,bdy)||1; points[back].x=points[back+1].x+bdx/bd*lengths[back]; points[back].y=points[back+1].y+bdy/bd*lengths[back]; }
            points[0] = { x: origin.x, y: origin.y };
            for (var f=1;f<points.length;f+=1) { var fdx=points[f].x-points[f-1].x,fdy=points[f].y-points[f-1].y,fd=Math.hypot(fdx,fdy)||1; points[f].x=points[f-1].x+fdx/fd*lengths[f-1]; points[f].y=points[f-1].y+fdy/fd*lengths[f-1]; }
        }
        return points;
    }

    function drawArticulated(state, now) {
        begin(state, now);
        var ctx=state.ctx,w=state.api.size.width,hgt=state.api.size.height,mode=state.def.algorithmIndex;
        var chains = mode === 2 ? 7 : mode === 3 ? 2 : 4;
        for (var c=0;c<chains;c+=1) {
            var origin={x:w*(.18+(c%4)*.2),y:hgt*(mode===2?.78:.72)};
            var target={x:state.pointer.x*w + Math.cos(now*.001+c)*w*.05,y:state.pointer.y*hgt + Math.sin(now*.0013+c)*hgt*.05};
            if (mode===3) { origin={x:w*(c? .72:.28),y:hgt*.72}; target={x:w*.5+(c?1:-1)*w*.08,y:state.pointer.y*hgt}; }
            var segments=mode===3?2:mode===2?12:mode===1?7:9;
            var length=Math.min(w,hgt)*(mode===2?.035:.055);
            var points=solveChain(origin,target,Array.from({length:segments},function(){return length;}),Math.sin(now*.001+c)*.06*(mode+1));
            ctx.strokeStyle=c%2?rgba(state.secondary,.52):rgba(state.accent,.68);ctx.lineWidth=mode===2?3:7;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();points.forEach(function(p,i){if(!i)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.stroke();
            points.forEach(function(p,i){ctx.fillStyle=i===points.length-1?state.secondary:"#07101e";ctx.strokeStyle=state.accent;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,i===points.length-1?8:5,0,TAU);ctx.fill();ctx.stroke();});
        }
    }

    function ensureParticles(state, count) {
        while (state.particles.length < count) state.particles.push({x:state.random(),y:state.random()*.8,vx:(state.random()-.5)*.001,vy:state.random()*.0015,r:2+state.random()*4,phase:state.random()*TAU});
        if (state.particles.length > count) state.particles.length=count;
    }

    function drawGranular(state, now, delta) {
        begin(state,now);
        var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex;
        var count=state.api.isPreview?150:280;ensureParticles(state,count);
        if(mode===2){
            var cols=25,rows=15;for(var y=0;y<rows;y+=1)for(var x=0;x<cols;x+=1){var dx=x-cols/2,dy=y-rows/2;var grains=Math.abs(Math.sin(dx*1.7+dy*.9+now*.001))*4+Math.max(0,8-Math.hypot(dx,dy));var level=Math.floor(grains+state.preset)%5;ctx.fillStyle=level>3?state.secondary:level>1?state.accent:rgba(state.accent,.16);ctx.fillRect(x/cols*w,y/rows*ht,w/cols+1,ht/rows+1);}return;
        }
        state.particles.forEach(function(p,index){
            if(mode===0||mode===1){p.vy+=.00004*(delta||16);p.x+=p.vx*(delta||16);p.y+=p.vy*(delta||16);var floor=.82-Math.abs(p.x-.5)*.28;if(p.y>floor){p.y=floor;p.vy*=-.18;p.vx+=(p.x-.5)*.00002;}if(state.pointer.down&&Math.hypot(p.x-state.pointer.x,p.y-state.pointer.y)<.13){p.vx+=(p.x-state.pointer.x)*.001;p.vy+=(p.y-state.pointer.y)*.001;}if(p.x<.05||p.x>.95)p.vx*=-1;if(p.y>1){p.y=0;p.vy=0;}}
            else{var angle=index/count*TAU+now*.0001;var targetRadius=.1+Math.sqrt(index/count)*.32;var tx=.5+Math.cos(angle)*targetRadius,ty=.5+Math.sin(angle)*targetRadius;p.x+=(tx-p.x)*.025;p.y+=(ty-p.y)*.025;}
            ctx.fillStyle=index%9===0?state.secondary:rgba(state.accent,.72);ctx.beginPath();ctx.arc(p.x*w,p.y*ht,mode===3?p.r*1.4:p.r,0,TAU);ctx.fill();
        });
    }

    function drawSwarm(state,now,delta){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,count=state.api.isPreview?72:130;ensureParticles(state,count);var dt=Math.min(2,(delta||16)/16.667);
        state.particles.forEach(function(p,i){var ax=0,ay=0;if(mode===0){for(var j=Math.max(0,i-8);j<Math.min(count,i+8);j++){if(i===j)continue;var q=state.particles[j],dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy)||1;if(d<.12){ax+=dx*.0002;ay+=dy*.0002;}if(d<.04){ax-=dx*.0018;ay-=dy*.0018;}}}else if(mode===1){ax=Math.cos(now*.0008+i*.18)*.0002;ay=Math.sin(now*.0008+i*.18)*.0002;}else if(mode===2){var dx=state.pointer.x-p.x,dy=state.pointer.y-p.y,d=Math.hypot(dx,dy)||1;ax+=dx/d*.00022*(state.pointer.down?-1:1);ay+=dy/d*.00022*(state.pointer.down?-1:1);}else{var field=Math.sin(p.x*18+now*.001)+Math.cos(p.y*16-now*.0013);ax=Math.cos(field*3)*.00025;ay=Math.sin(field*3)*.00025;state.trails.push({x:p.x,y:p.y,life:1});}
            p.vx=(p.vx+ax*dt)*.992;p.vy=(p.vy+ay*dt)*.992;var speed=Math.hypot(p.vx,p.vy)||1,max=.004;if(speed>max){p.vx=p.vx/speed*max;p.vy=p.vy/speed*max;}p.x=(p.x+p.vx*dt+1)%1;p.y=(p.y+p.vy*dt+1)%1;var angle=Math.atan2(p.vy,p.vx);ctx.save();ctx.translate(p.x*w,p.y*ht);ctx.rotate(angle);ctx.fillStyle=i%11===0?state.secondary:state.accent;ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-5,-3.5);ctx.lineTo(-2,0);ctx.lineTo(-5,3.5);ctx.closePath();ctx.fill();ctx.restore();});
        if(mode===3){state.trails=state.trails.slice(-1000);state.trails.forEach(function(t){t.life*=.986;ctx.fillStyle=rgba(state.secondary,t.life*.16);ctx.fillRect(t.x*w,t.y*ht,2,2);});}
    }

    function ensureNodes(state,count){while(state.nodes.length<count)state.nodes.push({x:.12+state.random()*.76,y:.12+state.random()*.76,vx:0,vy:0,size:3+state.random()*5,group:Math.floor(state.random()*4)});if(state.nodes.length>count)state.nodes.length=count;}

    function drawNetworks(state,now,delta){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,count=mode===3?34:state.api.isPreview?28:48;ensureNodes(state,count);var dt=Math.min(1.5,(delta||16)/16.667);
        state.nodes.forEach(function(a,i){if(mode===3){var layer=i%6;a.x+=(0.12+layer*.15-a.x)*.02;a.y+=(0.16+Math.floor(i/6)*.12-a.y)*.02;}else{for(var j=i+1;j<count;j++){var b=state.nodes[j],dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy+.001,force=(mode===1?.000004:mode===2?.000006:.000005)/d2;a.vx+=dx*force;a.vy+=dy*force;b.vx-=dx*force;b.vy-=dy*force;}var tx=state.pointer.down?state.pointer.x:.5,ty=state.pointer.down?state.pointer.y:.5;a.vx+=(tx-a.x)*.00018;a.vy+=(ty-a.y)*.00018;a.vx*=.92;a.vy*=.92;a.x=h.clamp(a.x+a.vx*dt,.04,.96);a.y=h.clamp(a.y+a.vy*dt,.05,.95);}});
        ctx.lineWidth=1;for(var i=0;i<count;i++){var links=mode===3?1:2+(mode===1?1:0);for(var l=1;l<=links;l++){var j=(i+l*(mode===2?7:3))%count,a=state.nodes[i],b=state.nodes[j];ctx.strokeStyle=rgba(i%2?state.accent:state.secondary,.18);ctx.beginPath();ctx.moveTo(a.x*w,a.y*ht);if(mode===3){var mx=(a.x+b.x)*.5*w;ctx.bezierCurveTo(mx,a.y*ht,mx,b.y*ht,b.x*w,b.y*ht);}else ctx.lineTo(b.x*w,b.y*ht);ctx.stroke();}}
        state.nodes.forEach(function(n,i){ctx.fillStyle=i%9===0?state.secondary:state.accent;ctx.beginPath();ctx.arc(n.x*w,n.y*ht,n.size,0,TAU);ctx.fill();});
    }

    function drawGrowth(state,now){
        begin(state,now,.12);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex;
        if(!state.trails.length){state.trails=[{x:.5,y:.82,px:.5,py:.82,angle:-Math.PI/2,life:1,depth:0}];}
        var additions=state.api.isPreview?2:4;for(var k=0;k<additions;k++){var parent=state.trails[Math.floor(state.random()*state.trails.length)],angle=parent.angle+(state.random()-.5)*(mode===0?2.4:mode===1?.75:mode===2?1.35:2.8);var length=(.006+state.random()*.018)*(mode===1?1.5:1);var nx=h.clamp(parent.x+Math.cos(angle)*length,.03,.97),ny=h.clamp(parent.y+Math.sin(angle)*length,.03,.97);if(mode===1){angle+=(state.pointer.x-nx)*.25;}if(mode===2){angle+=Math.sin(nx*20+ny*17+now*.001)*.65;}state.trails.push({x:nx,y:ny,px:parent.x,py:parent.y,angle:angle,life:1,depth:parent.depth+1});}
        var limit=state.api.isPreview?1200:2600;if(state.trails.length>limit)state.trails.splice(0,state.trails.length-limit);
        state.trails.forEach(function(segment,index){ctx.strokeStyle=index%17===0?rgba(state.secondary,.65):rgba(state.accent,.25+Math.min(.45,segment.depth*.004));ctx.lineWidth=mode===3?3:mode===1?1.6:1;ctx.beginPath();ctx.moveTo(segment.px*w,segment.py*ht);ctx.lineTo(segment.x*w,segment.y*ht);ctx.stroke();});
    }

    function initCells(state,cols,rows,states){
        var cells=new Uint8Array(cols*rows);for(var i=0;i<cells.length;i++)cells[i]=state.random()>(states>2?.7:.78)?Math.floor(state.random()*states):0;state.cells={data:cells,next:new Uint8Array(cells.length),cols:cols,rows:rows,states:states};
    }

    function stepCells(state){
        var grid=state.cells,data=grid.data,next=grid.next,cols=grid.cols,rows=grid.rows,mode=state.def.algorithmIndex;
        for(var y=0;y<rows;y++)for(var x=0;x<cols;x++){var index=y*cols+x;if(mode===0){var count=0;for(var oy=-1;oy<=1;oy++)for(var ox=-1;ox<=1;ox++){if(!ox&&!oy)continue;count+=data[((y+oy+rows)%rows)*cols+(x+ox+cols)%cols]?1:0;}next[index]=data[index]?(count===2||count===3):count===3;}else if(mode===1){var left=data[((y-1+rows)%rows)*cols+(x-1+cols)%cols],center=data[((y-1+rows)%rows)*cols+x],right=data[((y-1+rows)%rows)*cols+(x+1)%cols];var rule=[30,90,110,150][state.preset];next[index]=(rule>>((left<<2)|(center<<1)|right))&1;}else if(mode===2){var current=data[index],target=(current+1)%grid.states,found=false;for(var yy=-1;yy<=1;yy++)for(var xx=-1;xx<=1;xx++)if(data[((y+yy+rows)%rows)*cols+(x+xx+cols)%cols]===target)found=true;next[index]=found?target:current;}else{var sum=0;for(var ky=-2;ky<=2;ky++)for(var kx=-2;kx<=2;kx++)sum+=data[((y+ky+rows)%rows)*cols+(x+kx+cols)%cols];var avg=sum/25;next[index]=avg>0.34&&avg<0.66?1:data[index]*.94>state.random()?1:0;}}
        grid.data=next;grid.next=data;
    }

    function drawCellular(state,now){
        var cols=state.api.isPreview?54:84,rows=state.api.isPreview?30:48,states=state.def.algorithmIndex===2?8:2;if(!state.cells||state.cells.cols!==cols)initCells(state,cols,rows,states);if(now-state.lastStep>(state.def.algorithmIndex===3?45:85)){stepCells(state);state.lastStep=now;}begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,cw=w/cols,ch=ht/rows,data=state.cells.data;for(var i=0;i<data.length;i++){var value=data[i];if(!value)continue;var x=i%cols,y=Math.floor(i/cols);ctx.fillStyle=state.def.algorithmIndex===2?(value%2?state.accent:state.secondary):value?state.accent:rgba(state.secondary,.1);ctx.globalAlpha=state.def.algorithmIndex===2?.25+value/states*.75:.75;ctx.fillRect(x*cw+.5,y*ch+.5,cw-.8,ch-.8);}ctx.globalAlpha=1;
    }

    function initPathGrid(state){var cols=30,rows=18,blocked=new Uint8Array(cols*rows);for(var i=0;i<blocked.length;i++){var x=i%cols,y=Math.floor(i/cols);blocked[i]=(state.random()<.19&&x>2&&x<cols-3&&y>1&&y<rows-2)?1:0;}state.cells={cols:cols,rows:rows,blocked:blocked,cost:new Float32Array(cols*rows),path:[]};}

    function computePath(state){
        var g=state.cells,cols=g.cols,rows=g.rows,start={x:1,y:Math.floor(rows*.5)},goal={x:cols-2,y:h.clamp(Math.floor(state.pointer.y*rows),1,rows-2)},open=[start],came=new Int32Array(cols*rows);came.fill(-1);var visited=new Uint8Array(cols*rows),mode=state.def.algorithmIndex;while(open.length){open.sort(function(a,b){var ai=a.y*cols+a.x,bi=b.y*cols+b.x;var ah=mode===1?0:Math.abs(goal.x-a.x)+Math.abs(goal.y-a.y),bh=mode===1?0:Math.abs(goal.x-b.x)+Math.abs(goal.y-b.y);return g.cost[ai]+ah-(g.cost[bi]+bh);});var current=open.shift(),ci=current.y*cols+current.x;if(visited[ci])continue;visited[ci]=1;if(current.x===goal.x&&current.y===goal.y)break;[[1,0],[-1,0],[0,1],[0,-1]].forEach(function(dir){var nx=current.x+dir[0],ny=current.y+dir[1];if(nx<0||ny<0||nx>=cols||ny>=rows)return;var ni=ny*cols+nx;if(g.blocked[ni]||visited[ni])return;var newCost=g.cost[ci]+1+(mode===2&&((nx+ny)%5===0)?-.18:0);if(came[ni]===-1||newCost<g.cost[ni]){g.cost[ni]=newCost;came[ni]=ci;open.push({x:nx,y:ny});}});}var path=[],cursor=goal.y*cols+goal.x,safety=0;while(cursor>=0&&safety++<cols*rows){path.push({x:cursor%cols,y:Math.floor(cursor/cols)});if(cursor===start.y*cols+start.x)break;cursor=came[cursor];}g.path=path;g.visited=visited;
    }

    function drawPathPlanning(state,now){if(!state.cells||!state.cells.blocked)initPathGrid(state);computePath(state);begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,g=state.cells,cw=w/g.cols,ch=ht/g.rows;for(var i=0;i<g.blocked.length;i++){var x=i%g.cols,y=Math.floor(i/g.cols);if(g.blocked[i])ctx.fillStyle=rgba(state.secondary,.45);else if(g.visited[i])ctx.fillStyle=rgba(state.accent,.08);else continue;ctx.fillRect(x*cw+.5,y*ch+.5,cw-1,ch-1);}ctx.strokeStyle=state.accent;ctx.lineWidth=Math.max(2,cw*.18);ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();state.cells.path.slice().reverse().forEach(function(p,index){var x=(p.x+.5)*cw,y=(p.y+.5)*ch;if(!index)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();if(state.def.algorithmIndex===3){for(var yy=0;yy<g.rows;yy+=2)for(var xx=0;xx<g.cols;xx+=2){ctx.strokeStyle=rgba(state.secondary,.4);ctx.beginPath();ctx.moveTo((xx+.5)*cw,(yy+.5)*ch);ctx.lineTo((xx+1.2)*cw,(yy+.5+Math.sin(xx+yy+now*.001)*.35)*ch);ctx.stroke();}}
    }

    function drawComputationalGeometry(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex;ensureNodes(state,mode===3?18:22);state.nodes.forEach(function(n,i){n.x=h.clamp(n.x+Math.sin(now*.0004+i)*.00035,.05,.95);n.y=h.clamp(n.y+Math.cos(now*.00037+i*2)*.0003,.05,.95);});
        if(mode===0){var size=state.api.isPreview?18:12;for(var y=0;y<ht;y+=size)for(var x=0;x<w;x+=size){var best=Infinity,owner=0;state.nodes.forEach(function(n,i){var d=(n.x*w-x)*(n.x*w-x)+(n.y*ht-y)*(n.y*ht-y);if(d<best){best=d;owner=i;}});ctx.fillStyle=owner%2?rgba(state.accent,.22):rgba(state.secondary,.18);ctx.fillRect(x,y,size+1,size+1);}}
        else if(mode===1){ctx.strokeStyle=rgba(state.accent,.32);for(var i=0;i<state.nodes.length;i++){var distances=state.nodes.map(function(n,j){return {j:j,d:Math.hypot(n.x-state.nodes[i].x,n.y-state.nodes[i].y)};}).sort(function(a,b){return a.d-b.d;}).slice(1,4);distances.forEach(function(item){ctx.beginPath();ctx.moveTo(state.nodes[i].x*w,state.nodes[i].y*ht);ctx.lineTo(state.nodes[item.j].x*w,state.nodes[item.j].y*ht);ctx.stroke();});}}
        else if(mode===2){var pts=state.nodes.map(function(n){return{x:n.x*w,y:n.y*ht};}).sort(function(a,b){return a.x===b.x?a.y-b.y:a.x-b.x;});function cross(o,a,b){return(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);}var lower=[],upper=[];pts.forEach(function(p){while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop();lower.push(p);});pts.slice().reverse().forEach(function(p){while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop();upper.push(p);});var hull=lower.slice(0,-1).concat(upper.slice(0,-1));ctx.fillStyle=rgba(state.accent,.12);ctx.strokeStyle=state.accent;ctx.lineWidth=2;ctx.beginPath();hull.forEach(function(p,i){if(!i)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.closePath();ctx.fill();ctx.stroke();}
        else{var cols=34,rows=21,cw=w/(cols-1),ch=ht/(rows-1);ctx.strokeStyle=state.accent;ctx.lineWidth=1.5;for(var gy=0;gy<rows-1;gy++)for(var gx=0;gx<cols-1;gx++){var values=[[0,0],[1,0],[1,1],[0,1]].map(function(o){var nx=(gx+o[0])/(cols-1),ny=(gy+o[1])/(rows-1);return Math.sin(nx*12+now*.001)+Math.cos(ny*11-now*.0013)+Math.exp(-Math.hypot(nx-state.pointer.x,ny-state.pointer.y)*8)*2;});var mask=values.reduce(function(m,v,i){return m|(v>0?1<<i:0);},0);if(mask===0||mask===15)continue;ctx.beginPath();ctx.moveTo((gx+.5)*cw,gy*ch);ctx.lineTo((gx+.5)*cw,(gy+1)*ch);ctx.stroke();}}
        state.nodes.forEach(function(n,i){ctx.fillStyle=i%5===0?state.secondary:state.accent;ctx.beginPath();ctx.arc(n.x*w,n.y*ht,3.5,0,TAU);ctx.fill();});
    }

    function curvePoint(mode, points, t) {
        if (mode === 0) {
            var a = 1 - t;
            return { x: a*a*a*points[0].x + 3*a*a*t*points[1].x + 3*a*t*t*points[2].x + t*t*t*points[3].x, y: a*a*a*points[0].y + 3*a*a*t*points[1].y + 3*a*t*t*points[2].y + t*t*t*points[3].y };
        }
        if (mode === 1) {
            var segment = Math.min(points.length - 4, Math.floor(t * (points.length - 3)));
            var u = t * (points.length - 3) - segment;
            var p0=points[segment],p1=points[segment+1],p2=points[segment+2],p3=points[segment+3];
            return {x:.5*((2*p1.x)+(-p0.x+p2.x)*u+(2*p0.x-5*p1.x+4*p2.x-p3.x)*u*u+(-p0.x+3*p1.x-3*p2.x+p3.x)*u*u*u),y:.5*((2*p1.y)+(-p0.y+p2.y)*u+(2*p0.y-5*p1.y+4*p2.y-p3.y)*u*u+(-p0.y+3*p1.y-3*p2.y+p3.y)*u*u*u)};
        }
        if (mode === 2) {
            var b0=Math.pow(1-t,3)/6,b1=(3*t*t*t-6*t*t+4)/6,b2=(-3*t*t*t+3*t*t+3*t+1)/6,b3=t*t*t/6;
            return{x:points[0].x*b0+points[1].x*b1+points[2].x*b2+points[3].x*b3,y:points[0].y*b0+points[1].y*b1+points[2].y*b2+points[3].y*b3};
        }
        return {x:t,y:0.5};
    }

    function drawCurves(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,t=now*.001;
        var points=[{x:.12,y:.7},{x:.28,y:.18},{x:.54,y:.82},{x:.84,y:.28},{x:.92,y:.6},{x:.72,y:.75}];points.forEach(function(p,i){p.y+=Math.sin(t*.7+i)*.035;});if(state.pointer.down)points[2]={x:state.pointer.x,y:state.pointer.y};
        ctx.strokeStyle=rgba(state.secondary,.28);ctx.lineWidth=1;ctx.setLineDash([5,7]);ctx.beginPath();points.forEach(function(p,i){if(!i)ctx.moveTo(p.x*w,p.y*ht);else ctx.lineTo(p.x*w,p.y*ht);});ctx.stroke();ctx.setLineDash([]);
        ctx.strokeStyle=state.accent;ctx.lineWidth=4;ctx.lineCap="round";ctx.beginPath();
        if(mode<3){for(var i=0;i<=240;i++){var u=i/240,p=curvePoint(mode,points,u);if(!i)ctx.moveTo(p.x*w,p.y*ht);else ctx.lineTo(p.x*w,p.y*ht);}}
        else{var x=.14*w,y=.62*ht,angle=-.72,ds=Math.min(w,ht)*.004;ctx.moveTo(x,y);for(var step=0;step<260;step++){var s=step/260,curvature=(s-.5)*.09+(state.pointer.x-.5)*.035;angle+=curvature;x+=Math.cos(angle)*ds;y+=Math.sin(angle)*ds;ctx.lineTo(x,y);}}
        ctx.stroke();points.slice(0,mode===1?6:4).forEach(function(p,i){ctx.fillStyle=i===2?state.secondary:"#07101e";ctx.strokeStyle=state.accent;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x*w,p.y*ht,7,0,TAU);ctx.fill();ctx.stroke();});
    }

    function drawFractal(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex;
        if(mode<2){var pixel=state.api.isPreview?6:4,zoom=1.35+state.scroll*8+Math.sin(now*.0003)*.08,cx=mode===0?-.66:-.02,cy=0;for(var y=0;y<ht;y+=pixel)for(var x=0;x<w;x+=pixel){var zx=(x/w-.5)*3/zoom+cx,zy=(y/ht-.5)*2/zoom+cy,cr=mode===0?zx:-.745+state.pointer.x*.18,ci=mode===0?zy:.113+(state.pointer.y-.5)*.24;if(mode===0){zx=0;zy=0;}var iter=0;for(;iter<42&&zx*zx+zy*zy<4;iter++){var nextX=zx*zx-zy*zy+cr;zy=2*zx*zy+ci;zx=nextX;}var alpha=iter===42?0.06:.15+iter/42*.85;ctx.fillStyle=iter%5<2?rgba(state.accent,alpha):rgba(state.secondary,alpha);ctx.fillRect(x,y,pixel+1,pixel+1);}}
        else if(mode===2){var x0=.5,y0=.1;ctx.fillStyle=rgba(state.accent,.55);for(var i=0;i<(state.api.isPreview?18000:42000);i++){var r=state.random(),nx,ny;if(r<.01){nx=0;ny=.16*y0;}else if(r<.86){nx=.85*x0+.04*y0;ny=-.04*x0+.85*y0+1.6;}else if(r<.93){nx=.2*x0-.26*y0;ny=.23*x0+.22*y0+1.6;}else{nx=-.15*x0+.28*y0;ny=.26*x0+.24*y0+.44;}x0=nx;y0=ny;ctx.fillRect(w*.5+x0*w*.09,ht*.95-y0*ht*.095,1,1);}}
        else{var iterations=14+Math.floor(state.scroll*4),segments=[{x1:w*.22,y1:ht*.68,x2:w*.78,y2:ht*.68}];for(var it=0;it<iterations;it++){var next=[];segments.forEach(function(s){var mx=(s.x1+s.x2)*.5,my=(s.y1+s.y2)*.5,dx=(s.x2-s.x1)*.5,dy=(s.y2-s.y1)*.5;next.push({x1:s.x1,y1:s.y1,x2:mx-dy,y2:my+dx},{x1:mx-dy,y1:my+dx,x2:s.x2,y2:s.y2});});segments=next;if(segments.length>12000)break;}ctx.strokeStyle=state.accent;ctx.lineWidth=1;ctx.beginPath();segments.forEach(function(s,i){if(!i)ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);});ctx.stroke();}
    }

    function initChaos(state){state.chaos={x:.1,y:0,z:0,x2:.11,y2:.07,a:.5,b:.2};state.trails=[];}
    function drawChaos(state,now){
        if(!state.chaos)initChaos(state);begin(state,now,.075);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,p=state.chaos;
        for(var i=0;i<(state.api.isPreview?90:180);i++){var ox=p.x,oy=p.y;if(mode===0){var dt=.006,sigma=10,rho=25+state.pointer.x*7,beta=8/3;p.x+=(sigma*(p.y-p.x))*dt;p.y+=(p.x*(rho-p.z)-p.y)*dt;p.z+=(p.x*p.y-beta*p.z)*dt;}else if(mode===1){var a=-1.4+state.pointer.x*.5,b=1.6,c=1,d=.7;p.x=Math.sin(a*p.y)+c*Math.cos(a*p.x);p.y=Math.sin(b*p.x)+d*Math.cos(b*p.y);}else if(mode===2){var t=.4-6/(1+p.x*p.x+p.y*p.y);var nx=1+.9*(p.x*Math.cos(t)-p.y*Math.sin(t));p.y=.9*(p.x*Math.sin(t)+p.y*Math.cos(t));p.x=nx;}else{var g=9.81,l=1,dtp=.012;var da=(-g/l*Math.sin(p.a)-.22*Math.sin(p.a-p.b));var db=(-g/l*Math.sin(p.b)+.22*Math.sin(p.a-p.b));p.x2+=da*dtp;p.y2+=db*dtp;p.a+=p.x2*dtp;p.b+=p.y2*dtp;p.x=p.a;p.y=p.x2;}
            var sx,sy,sox,soy;if(mode===0){sx=w*.5+p.x*w*.012;sy=ht*.82-p.z*ht*.022;sox=w*.5+ox*w*.012;soy=ht*.82-p.z*ht*.022;}else{var scale=mode===1?.16:mode===2?.13:.18;sx=w*.5+p.x*w*scale;sy=ht*.5+p.y*ht*scale;sox=w*.5+ox*w*scale;soy=ht*.5+oy*ht*scale;}ctx.strokeStyle=i%9===0?rgba(state.secondary,.55):rgba(state.accent,.27);ctx.beginPath();ctx.moveTo(sox,soy);ctx.lineTo(sx,sy);ctx.stroke();}
    }

    function drawOptics(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,t=now*.001;
        if(mode===0){var bands=state.api.isPreview?100:160;for(var x=0;x<bands;x++){var nx=x/bands-.5,phase=nx*nx*(50+state.pointer.x*80)+Math.sin(t)*2,intensity=Math.pow(Math.cos(phase),2);ctx.fillStyle=rgba(intensity>.5?state.accent:state.secondary,.08+intensity*.78);ctx.fillRect(x/bands*w,0,w/bands+1,ht);}ctx.fillStyle="#fff";ctx.fillRect(w*.48,ht*.08,2,ht*.1);ctx.fillRect(w*.52,ht*.08,2,ht*.1);}
        else if(mode===1){ctx.lineWidth=1;for(var i=-90;i<90;i++){var angle1=(i*.07+state.pointer.x*.4),angle2=(i*.073-state.pointer.y*.35);ctx.strokeStyle=i%2?rgba(state.accent,.2):rgba(state.secondary,.18);ctx.beginPath();ctx.moveTo(w*.5-Math.cos(angle1)*w,ht*.5-Math.sin(angle1)*w);ctx.lineTo(w*.5+Math.cos(angle1)*w,ht*.5+Math.sin(angle1)*w);ctx.stroke();ctx.beginPath();ctx.moveTo(w*.5-Math.cos(angle2)*w,ht*.5-Math.sin(angle2)*w);ctx.lineTo(w*.5+Math.cos(angle2)*w,ht*.5+Math.sin(angle2)*w);ctx.stroke();}}
        else if(mode===2){var cx=state.pointer.x*w,cy=state.pointer.y*ht;var obstacles=[];for(var j=0;j<9;j++){var ox=w*(.12+(j%3)*.36),oy=ht*(.18+Math.floor(j/3)*.32),rw=w*.08,rh=ht*.055;obstacles.push({x:ox,y:oy,rw:rw,rh:rh});ctx.fillStyle="rgba(5,8,23,.85)";ctx.strokeStyle=rgba(state.secondary,.55);ctx.fillRect(ox-rw,oy-rh,rw*2,rh*2);ctx.strokeRect(ox-rw,oy-rh,rw*2,rh*2);}ctx.fillStyle=rgba(state.accent,.18);ctx.beginPath();ctx.moveTo(cx,cy);for(var r=0;r<=360;r++){var a=r/360*TAU,d=Math.max(w,ht);obstacles.forEach(function(o){var dx=o.x-cx,dy=o.y-cy,projection=dx*Math.cos(a)+dy*Math.sin(a);if(projection>0&&Math.abs(dx*Math.sin(a)-dy*Math.cos(a))<Math.max(o.rw,o.rh))d=Math.min(d,projection);});ctx.lineTo(cx+Math.cos(a)*d,cy+Math.sin(a)*d);}ctx.closePath();ctx.fill();}
        else{ctx.lineWidth=1.4;for(var ray=0;ray<70;ray++){var x0=state.pointer.x*w,y0=state.pointer.y*ht,angle=ray/70*TAU+t*.1;ctx.strokeStyle=ray%6===0?state.secondary:rgba(state.accent,.24);ctx.beginPath();ctx.moveTo(x0,y0);for(var bounce=0;bounce<6;bounce++){var dx=Math.cos(angle),dy=Math.sin(angle),tx=dx>0?(w-x0)/dx:-x0/dx,ty=dy>0?(ht-y0)/dy:-y0/dy;if(tx<ty){x0+=dx*tx;y0+=dy*tx;angle=Math.PI-angle;}else{x0+=dx*ty;y0+=dy*ty;angle=-angle;}ctx.lineTo(x0,y0);}ctx.stroke();}}
    }

    function imageValue(x,y,state,now){var dx=x-.52,dy=y-.48;var portrait=Math.exp(-(dx*dx*8+dy*dy*11));var rings=.5+.5*Math.sin(Math.hypot(dx,dy)*36-now*.0015);var bars=.5+.5*Math.sin(x*18+y*9);return h.clamp(portrait*.8+rings*.28+bars*.16,0,1);}
    function drawImageReconstruction(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,cell=state.api.isPreview?9:6,cols=Math.ceil(w/cell),rows=Math.ceil(ht/cell);
        if(mode===2){for(var i=0;i<(state.api.isPreview?900:1800);i++){var x=(state.random()+Math.sin(i*12.989)*.03+1)%1,y=(state.random()+Math.cos(i*9.17)*.03+1)%1,v=imageValue(x,y,state,now);ctx.fillStyle=v>.55?state.accent:rgba(state.secondary,.55);ctx.beginPath();ctx.arc(x*w,y*ht,1+v*3.2,0,TAU);ctx.fill();}return;}
        for(var y=0;y<rows;y++)for(var x=0;x<cols;x++){var nx=x/cols,ny=y/rows,v=imageValue(nx,ny,state,now),threshold;if(mode===0){var bayer=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];threshold=(bayer[y%4][x%4]+.5)/16;}else if(mode===1){threshold=.5+Math.sin(x*.8+y*1.7)*.08;}else{threshold=.42+Math.sin(y*.45+now*.001)*.2;}var on=v>threshold;ctx.fillStyle=on?(x+y)%3?state.accent:state.secondary:"rgba(255,255,255,.025)";if(mode===3&&Math.abs(x-cols*(.25+.5*state.pointer.x))<2)ctx.fillStyle="#fff";ctx.fillRect(x*cell,y*cell,cell-1,cell-1);}
    }

    function ensureBuffer(state){var canvas=state.buffer;if(!canvas){canvas=document.createElement("canvas");state.buffer=canvas;state.bufferContext=canvas.getContext("2d");}var pw=state.api.canvas.width,ph=state.api.canvas.height;if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;}}
    function drawTemporal(state,now){
        ensureBuffer(state);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,bctx=state.bufferContext;bctx.setTransform(1,0,0,1,0,0);bctx.clearRect(0,0,state.buffer.width,state.buffer.height);bctx.drawImage(state.api.canvas,0,0);ctx.fillStyle="rgba(5,8,23,.12)";ctx.fillRect(0,0,w,ht);ctx.save();ctx.globalAlpha=.91;ctx.translate(w*.5,ht*.5);if(mode===1){ctx.rotate(.012+state.pointer.x*.012);ctx.scale(.986,.986);}else if(mode===2){ctx.rotate(Math.sin(now*.0007)*.006);ctx.scale(1.004,.996);}else if(mode===3){ctx.translate(Math.sin(now*.002)*6,Math.cos(now*.0017)*4);}ctx.translate(-w*.5,-ht*.5);ctx.drawImage(state.buffer,0,0,w,ht);ctx.restore();
        if(mode===0){var slices=32;for(var i=0;i<slices;i++){var x=i/slices*w,offset=Math.sin(now*.001+i*.55)*18;ctx.globalAlpha=.5;ctx.drawImage(state.buffer,x*state.api.size.dpr,0,w/slices*state.api.size.dpr,state.buffer.height,x+offset,0,w/slices+1,ht);}ctx.globalAlpha=1;}
        var x=state.pointer.x*w,y=state.pointer.y*ht;ctx.fillStyle=state.accent;ctx.shadowColor=state.secondary;ctx.shadowBlur=28;ctx.beginPath();ctx.arc(x,y,18+Math.sin(now*.004)*7,0,TAU);ctx.fill();ctx.shadowBlur=0;for(var n=0;n<8;n++){ctx.strokeStyle=rgba(n%2?state.secondary:state.accent,.35);ctx.strokeRect(x-20-n*7,y-20-n*7,40+n*14,40+n*14);}
    }

    function rotate3D(point,ax,ay){var x=point.x*Math.cos(ay)-point.z*Math.sin(ay),z=point.x*Math.sin(ay)+point.z*Math.cos(ay),y=point.y*Math.cos(ax)-z*Math.sin(ax);z=point.y*Math.sin(ax)+z*Math.cos(ax);return{x:x,y:y,z:z};}
    function drawSpatial3D(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,ax=(state.pointer.y-.5)*1.1+Math.sin(now*.0004)*.12,ay=(state.pointer.x-.5)*1.5+now*.00015;
        var vertices=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
        var copies=mode===2?5:mode===3?3:mode===1?4:1;for(var c=0;c<copies;c++){var scale=Math.min(w,ht)*(.13+(mode===1?c*.035:0)),offset=(c-(copies-1)/2)*w*(mode===2?.12:mode===3?.18:0),points=vertices.map(function(v){var expand=mode===2?1+c*.18:1,p=rotate3D({x:v[0]*expand,y:v[1]*expand,z:v[2]*expand},ax+c*.08,ay+c*.12),depth=3.8+p.z+(mode===1?Math.sin(now*.0008)*c*.25:0);return{x:w*.5+offset+p.x/depth*scale*4,y:ht*.5+p.y/depth*scale*4,z:p.z};});edges.forEach(function(e,i){ctx.strokeStyle=i%3?rgba(state.accent,.42):state.secondary;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(points[e[0]].x,points[e[0]].y);ctx.lineTo(points[e[1]].x,points[e[1]].y);ctx.stroke();});points.forEach(function(p){ctx.fillStyle=p.z>0?state.accent:rgba(state.secondary,.48);ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,TAU);ctx.fill();});}
        if(mode===3){ctx.strokeStyle="rgba(255,255,255,.55)";ctx.strokeRect(w*.18,ht*.18,w*.64,ht*.64);ctx.fillStyle=rgba(state.accent,.08);ctx.fillRect(w*.18,ht*.18,w*.64,ht*.64);}
    }

    function drawGesturePen(state,now){
        begin(state,now,.24);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex;if(!state.trails.length){for(var i=0;i<120;i++){var a=i/119*TAU;state.trails.push({x:.5+Math.cos(a)*.21,y:.5+Math.sin(a)*.27,p:.3+.7*Math.sin(a*.5)*Math.sin(a*.5)});}}
        if(state.pointer.down){state.trails.push({x:state.pointer.x,y:state.pointer.y,p:state.pointer.pressure||.5});if(state.trails.length>500)state.trails.shift();}
        ctx.lineCap="round";ctx.lineJoin="round";for(var j=1;j<state.trails.length;j++){var a0=state.trails[j-1],b0=state.trails[j];ctx.strokeStyle=j%7?rgba(state.accent,.62):state.secondary;ctx.lineWidth=mode===3?2+(b0.p||.5)*16:mode===2?5+Math.sin(j*.2)*3:4;ctx.beginPath();ctx.moveTo(a0.x*w,a0.y*ht);ctx.lineTo(b0.x*w,b0.y*ht);ctx.stroke();if(mode===1&&j%9===0){ctx.fillStyle=rgba(state.secondary,.35);ctx.beginPath();ctx.arc(b0.x*w,b0.y*ht,7,0,TAU);ctx.fill();}}
        if(mode<2){ctx.fillStyle="rgba(255,255,255,.72)";setCanvasFont(ctx,800,12,"Cascadia Code, monospace");ctx.fillText(mode===0?"TEMPLATE MATCH / CIRCLE":"POINT CLOUD / NORMALIZED",18,28);}else if(mode===2){ctx.strokeStyle=rgba(state.secondary,.65);ctx.strokeRect(w*.32,ht*.24,w*.36,ht*.52);ctx.save();ctx.translate(w*.5,ht*.5);ctx.rotate((state.pointer.x-.5)*1.2);ctx.scale(.7+state.pointer.y,.7+state.pointer.y);ctx.strokeStyle=state.accent;ctx.lineWidth=4;ctx.strokeRect(-w*.12,-ht*.15,w*.24,ht*.3);ctx.restore();}
    }

    function drawTargetAcquisition(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex;ensureNodes(state,32);var px=state.pointer.x*w,py=state.pointer.y*ht,best=null,second=null;state.nodes.forEach(function(n){var d=Math.hypot(n.x*w-px,n.y*ht-py);if(!best||d<best.d){second=best;best={n:n,d:d};}else if(!second||d<second.d)second={n:n,d:d};});
        if(mode===0&&best){var radius=Math.min(second?second.d:80,best.d+best.n.size+18);ctx.strokeStyle=state.accent;ctx.lineWidth=2;ctx.fillStyle=rgba(state.accent,.08);ctx.beginPath();ctx.arc(px,py,radius,0,TAU);ctx.fill();ctx.stroke();}
        if(mode===1){state.nodes.forEach(function(n,i){ctx.strokeStyle=rgba(state.accent,.08);for(var a=0;a<TAU;a+=Math.PI/4){ctx.beginPath();ctx.moveTo(n.x*w,n.y*ht);ctx.lineTo(n.x*w+Math.cos(a)*90,n.y*ht+Math.sin(a)*90);ctx.stroke();}});}
        if(mode===2&&state.pointer.down){ctx.strokeStyle=state.secondary;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(w*.1,py);ctx.lineTo(px,py);ctx.stroke();}
        if(mode===3&&best&&best.d<90){for(var i=0;i<7;i++){var a=-1.2+i*.4,x=best.n.x*w+Math.cos(a)*80,y=best.n.y*ht+Math.sin(a)*80;ctx.strokeStyle=rgba(state.secondary,.35);ctx.beginPath();ctx.moveTo(best.n.x*w,best.n.y*ht);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle=i===3?state.secondary:state.accent;ctx.beginPath();ctx.arc(x,y,9,0,TAU);ctx.fill();}}
        state.nodes.forEach(function(n,i){var active=best&&n===best.n;ctx.fillStyle=active?state.secondary:rgba(state.accent,.72);ctx.beginPath();ctx.arc(n.x*w,n.y*ht,n.size+(active?4:0),0,TAU);ctx.fill();});
    }

    function roundRect(ctx,x,y,w,hgt,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,hgt,r);if(fill)ctx.fill();if(stroke)ctx.stroke();}
    function drawNavigation(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,px=state.pointer.x*w,py=state.pointer.y*ht;
        if(mode===0){for(var i=0;i<8;i++){var a=i/8*TAU-Math.PI/2,x=w*.5+Math.cos(a)*Math.min(w,ht)*.27,y=ht*.5+Math.sin(a)*Math.min(w,ht)*.27,active=Math.abs(Math.atan2(py-ht*.5,px-w*.5)-a)<.38;ctx.fillStyle=active?state.secondary:rgba(state.accent,.2);ctx.strokeStyle=active?"#fff":rgba(state.accent,.5);roundRect(ctx,x-28,y-22,56,44,13,true,true);}ctx.fillStyle="#07101e";ctx.strokeStyle=state.accent;roundRect(ctx,w*.5-43,ht*.5-43,86,86,43,true,true);}
        else if(mode===1){var progress=h.clamp((state.pointer.x+.5*state.scroll),0,1);ctx.globalAlpha=1-progress;for(var c=0;c<12;c++){ctx.fillStyle=c%2?state.accent:state.secondary;ctx.beginPath();ctx.arc(w*(.15+(c%4)*.23),ht*(.23+Math.floor(c/4)*.27),12+progress*20,0,TAU);ctx.fill();}ctx.globalAlpha=progress;ctx.fillStyle="#eef2ff";roundRect(ctx,w*.18,ht*.16,w*.64,ht*.68,28,true,false);ctx.fillStyle="#11172b";setCanvasFont(ctx,900,Math.min(w,ht)*.09);ctx.fillText("DETAIL",w*.25,ht*.47);ctx.globalAlpha=1;}
        else{var cols=4,rows=3,focusX=Math.round(state.pointer.x*(cols-1)),focusY=Math.round(state.pointer.y*(rows-1));for(var y=0;y<rows;y++)for(var x=0;x<cols;x++){var distance=Math.hypot(x-focusX,y-focusY),scale=mode===3?1+Math.max(0,1-distance)*.38:1,cellW=w*.17*scale,cellH=ht*.18*scale,cx=w*(.17+x*.22),cy=ht*(.22+y*.27);ctx.fillStyle=x===focusX&&y===focusY?rgba(state.secondary,.58):rgba(state.accent,.12);ctx.strokeStyle=x===focusX&&y===focusY?"#fff":rgba(state.accent,.35);ctx.lineWidth=x===focusX&&y===focusY?3:1;roundRect(ctx,cx-cellW/2,cy-cellH/2,cellW,cellH,18,true,true);}}
    }

    function drawMicro(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,t=now*.001,px=state.pointer.x*w,py=state.pointer.y*ht;
        if(mode===0){var bw=w*.38,bh=ht*.18,bx=w*.5-bw/2,by=ht*.5-bh/2;ctx.fillStyle=rgba(state.accent,.22);ctx.strokeStyle=state.accent;roundRect(ctx,bx,by,bw,bh,bh/2,true,true);state.pulses.forEach(function(p){var age=(now-p.born)/900;if(age<1){ctx.save();ctx.beginPath();ctx.roundRect(bx,by,bw,bh,bh/2);ctx.clip();ctx.globalAlpha=1-age;ctx.strokeStyle=state.secondary;ctx.lineWidth=5;ctx.beginPath();ctx.arc(p.x*w,p.y*ht,age*Math.hypot(bw,bh),0,TAU);ctx.stroke();ctx.restore();}});}
        else if(mode===1){var progress=state.pointer.down?h.clamp((now-(state.pulses[state.pulses.length-1]||{born:now}).born)/1300,0,1):(.5+.5*Math.sin(t))*.3;ctx.lineWidth=16;ctx.strokeStyle=rgba(state.accent,.18);ctx.beginPath();ctx.arc(w*.5,ht*.5,Math.min(w,ht)*.2,0,TAU);ctx.stroke();ctx.strokeStyle=state.accent;ctx.beginPath();ctx.arc(w*.5,ht*.5,Math.min(w,ht)*.2,-Math.PI/2,-Math.PI/2+TAU*progress);ctx.stroke();}
        else if(mode===2){for(var i=0;i<4;i++){var y=ht*(.2+i*.18),shift=(state.pointer.y>i/4&&state.pointer.y<(i+1)/4)?(state.pointer.x-.5)*w*.35:Math.sin(t+i)*12;ctx.fillStyle=rgba(state.secondary,.35);roundRect(ctx,w*.2,y,w*.6,ht*.12,16,true,false);ctx.fillStyle="#11172b";ctx.strokeStyle=rgba(state.accent,.4);roundRect(ctx,w*.2+shift,y,w*.6,ht*.12,16,true,true);}}
        else{var shapes=["READY","ACTIVE","SUCCESS","RESET"],index=(Math.floor(t*.65)+state.preset)%4,size=Math.min(w,ht)*(.18+index*.025);ctx.save();ctx.translate(w*.5,ht*.5);ctx.rotate(index*Math.PI/4+Math.sin(t)*.1);ctx.fillStyle=index===2?state.secondary:state.accent;ctx.beginPath();if(index%2===0)ctx.roundRect(-size,-size*.65,size*2,size*1.3,index===0?size*.65:24);else{for(var p=0;p<8;p++){var a=p/8*TAU,r=p%2?size*.55:size,x=Math.cos(a)*r,y=Math.sin(a)*r;if(!p)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();}ctx.fill();ctx.restore();ctx.fillStyle="#fff";setCanvasFont(ctx,800,12,"Cascadia Code, monospace");ctx.fillText(shapes[index],w*.5-28,ht*.82);}
    }

    function drawScrubbing(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,trackY=ht*.68,position=mode===3?.5+.45*Math.sin(now*.0007):state.pointer.x;if(mode===0)position=Math.pow(state.pointer.x,1+state.pointer.y*4);if(mode===1)position=h.clamp(state.pointer.x+(state.velocity*.006),0,1);if(mode===2)position=Math.round(state.pointer.x*16)/16;
        ctx.strokeStyle=rgba(state.accent,.25);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w*.08,trackY);ctx.lineTo(w*.92,trackY);ctx.stroke();for(var i=0;i<=32;i++){var x=w*(.08+i/32*.84),major=i%4===0;ctx.strokeStyle=major?state.accent:rgba(state.accent,.3);ctx.beginPath();ctx.moveTo(x,trackY-(major?18:7));ctx.lineTo(x,trackY+(major?18:7));ctx.stroke();}
        for(var frame=0;frame<9;frame++){var fx=w*(.08+frame/9*.84),fw=w*.084,phase=frame*.8+position*8;ctx.fillStyle=frame/9<position?rgba(state.secondary,.38):rgba(state.accent,.12);roundRect(ctx,fx,ht*.2,fw,ht*.27,12,true,false);ctx.strokeStyle=rgba(state.accent,.22);ctx.beginPath();ctx.moveTo(fx+fw*.18,ht*(.38+Math.sin(phase)*.04));ctx.lineTo(fx+fw*.82,ht*(.29+Math.cos(phase)*.05));ctx.stroke();}
        var cursorX=w*(.08+position*.84);ctx.strokeStyle="#fff";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cursorX,ht*.15);ctx.lineTo(cursorX,ht*.82);ctx.stroke();ctx.fillStyle=state.secondary;ctx.beginPath();ctx.arc(cursorX,trackY,9,0,TAU);ctx.fill();
    }

    function drawDataLayout(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,t=now*.001;
        if(mode===0){var x=w*.1,y=ht*.14,rw=w*.8,rh=ht*.72;for(var i=0;i<18;i++){var horizontal=i%2===0,ratio=.28+.35*(.5+.5*Math.sin(t*.5+i));ctx.fillStyle=i%3===0?rgba(state.secondary,.45):rgba(state.accent,.16+i%4*.08);ctx.strokeStyle="rgba(255,255,255,.18)";if(horizontal){var part=rw*ratio;roundRect(ctx,x,y,part,rh,6,true,true);x+=part;rw-=part;}else{var partH=rh*ratio;roundRect(ctx,x,y,rw,partH,6,true,true);y+=partH;rh-=partH;}if(rw<12||rh<12)break;}}
        else if(mode===1){var circles=[{x:.5,y:.5,r:.3,depth:0}];for(var c=0;c<24;c++){var parent=circles[Math.floor(circles.length*.35)],a=c*2.399,r=parent.r*(.18+(c%4)*.035);circles.push({x:parent.x+Math.cos(a)*(parent.r-r)*.72,y:parent.y+Math.sin(a)*(parent.r-r)*.72,r:r,depth:parent.depth+1});}circles.forEach(function(c,i){ctx.fillStyle=i%5===0?rgba(state.secondary,.35):rgba(state.accent,.1);ctx.strokeStyle=i%5===0?state.secondary:rgba(state.accent,.45);ctx.beginPath();ctx.arc(c.x*w,c.y*ht,c.r*Math.min(w,ht),0,TAU);ctx.fill();ctx.stroke();});}
        else if(mode===2){var left=Array.from({length:6},function(_,i){return{x:w*.15,y:ht*(.15+i*.14)};}),right=Array.from({length:5},function(_,i){return{x:w*.85,y:ht*(.2+i*.15)};});left.forEach(function(a,i){right.forEach(function(b,j){var value=(Math.sin(i*2+j+t)+1)/2;ctx.strokeStyle=rgba((i+j)%2?state.accent:state.secondary,.06+value*.22);ctx.lineWidth=1+value*10;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.bezierCurveTo(w*.42,a.y,w*.58,b.y,b.x,b.y);ctx.stroke();});});left.concat(right).forEach(function(n,i){ctx.fillStyle=i%2?state.secondary:state.accent;roundRect(ctx,n.x-10,n.y-26,20,52,8,true,false);});}
        else{var lanes=12,values=Array.from({length:lanes},function(_,i){return(i*7+state.preset*3)%lanes;});for(var stage=0;stage<8;stage++){var x=w*(.12+stage*.1);for(var lane=0;lane<lanes;lane++){var y1=ht*(.12+lane/(lanes-1)*.76),swap=(lane+stage*3)%lanes,y2=ht*(.12+swap/(lanes-1)*.76);ctx.strokeStyle=lane%3===0?state.secondary:rgba(state.accent,.3);ctx.beginPath();ctx.moveTo(x,y1);ctx.lineTo(x+w*.1,y2);ctx.stroke();ctx.fillStyle=state.accent;ctx.beginPath();ctx.arc(x,y1,2.5,0,TAU);ctx.fill();}}}
    }

    function drawTypography(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,t=now*.001;ctx.textAlign="center";ctx.textBaseline="middle";
        if(mode===0){var weight=500+Math.round(state.pointer.y*400),widthScale=.65+state.pointer.x*.7;ctx.save();ctx.translate(w*.5,ht*.5);ctx.scale(widthScale,1);ctx.fillStyle=state.accent;setCanvasFont(ctx,weight,Math.min(w,ht)*.27);ctx.fillText("AXIS",0,0);ctx.restore();}
        else if(mode===1){ctx.save();ctx.translate(w*.5,ht*.5);setCanvasFont(ctx,900,Math.min(w,ht)*.25);ctx.strokeStyle=rgba(state.accent,.25);ctx.strokeText("MESH",0,0);for(var i=0;i<150;i++){var a=i*2.399,r=Math.sqrt(i/150)*Math.min(w,ht)*.22,x=Math.cos(a+t*.08)*r,y=Math.sin(a+t*.08)*r*.55;ctx.fillStyle=i%5===0?state.secondary:state.accent;ctx.beginPath();ctx.moveTo(x,y-3);ctx.lineTo(x+5,y+4);ctx.lineTo(x-5,y+4);ctx.closePath();ctx.fill();}ctx.restore();}
        else if(mode===2){ctx.save();ctx.translate(w*.5,ht*.5);var slices=24;for(var s=0;s<slices;s++){ctx.save();ctx.beginPath();ctx.rect(-w*.42,-ht*.3+s/slices*ht*.6,w*.84,ht*.6/slices+1);ctx.clip();var offset=Math.sin(s*.6+t*2+state.pointer.x*4)*18*(.2+state.pointer.y);ctx.translate(offset,0);ctx.fillStyle=s%3===0?state.secondary:state.accent;setCanvasFont(ctx,900,Math.min(w,ht)*.23);ctx.fillText("FIELD",0,0);ctx.restore();}ctx.restore();}
        else{var text="COMPUTATIONAL TYPOGRAPHY · PATH LAYOUT · ",radius=Math.min(w,ht)*.27;ctx.save();ctx.translate(w*.5,ht*.5);Array.from(text).forEach(function(char,i){var a=i/text.length*TAU+t*.18;ctx.save();ctx.rotate(a);ctx.translate(0,-radius);ctx.rotate(Math.PI/2);ctx.fillStyle=i%5===0?state.secondary:state.accent;setCanvasFont(ctx,800,Math.min(w,ht)*.035);ctx.fillText(char,0,0);ctx.restore();});ctx.restore();}
        ctx.textAlign="start";ctx.textBaseline="alphabetic";
    }

    function drawAudio(state,now){
        begin(state,now,.18);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,t=now*.001,bins=state.audioData||null;
        function sample(i,count){if(bins&&bins.length)return bins[Math.floor(i/count*bins.length)]/255;return .18+.16*Math.sin(t*2+i*.29)+.12*Math.sin(t*.73+i*.11);}
        if(mode===0){var count=state.api.isPreview?56:96,bw=w/count;for(var i=0;i<count;i++){var v=h.clamp(sample(i,count),.03,1),bar=v*ht*.72;ctx.fillStyle=i%7===0?state.secondary:state.accent;ctx.fillRect(i*bw,ht-bar,bw*.72,bar);}}
        else if(mode===1){for(var ring=0;ring<26;ring++){var v=sample(ring,26),radius=Math.min(w,ht)*(.05+ring*.012);ctx.strokeStyle=v>.37?state.secondary:rgba(state.accent,.18+v*.7);ctx.lineWidth=1+v*8;ctx.beginPath();ctx.arc(w*.5,ht*.5,radius,0,TAU);ctx.stroke();}}
        else if(mode===2){ctx.beginPath();for(var x=0;x<=w;x+=3){var nx=x/w,v=.5+.32*Math.sin(nx*TAU*(3+state.preset)+t*2)*(.45+sample(Math.floor(nx*64),64));var y=v*ht;if(!x)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.lineTo(w,ht);ctx.lineTo(0,ht);ctx.closePath();var grad=ctx.createLinearGradient(0,0,0,ht);grad.addColorStop(0,state.secondary);grad.addColorStop(1,rgba(state.accent,.08));ctx.fillStyle=grad;ctx.fill();}
        else{var sourceX=state.pointer.x*w,sourceY=state.pointer.y*ht,listenerX=w*.5,listenerY=ht*.5;ctx.strokeStyle=rgba(state.accent,.25);for(var r=1;r<8;r++){ctx.beginPath();ctx.arc(sourceX,sourceY,r*Math.min(w,ht)*.055+(t*30%40),0,TAU);ctx.stroke();}ctx.strokeStyle=state.secondary;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(listenerX,listenerY);ctx.lineTo(sourceX,sourceY);ctx.stroke();ctx.fillStyle=state.accent;ctx.beginPath();ctx.arc(sourceX,sourceY,15,0,TAU);ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(listenerX,listenerY,9,0,TAU);ctx.fill();}
    }

    function ensureCompositionBuffer(state) {
        if (!state.compositionBuffer) {
            state.compositionBuffer = document.createElement("canvas");
            state.compositionContext = state.compositionBuffer.getContext("2d");
        }
        var width = state.api.canvas.width, height = state.api.canvas.height;
        if (state.compositionBuffer.width !== width || state.compositionBuffer.height !== height) {
            state.compositionBuffer.width = width;
            state.compositionBuffer.height = height;
        }
        state.compositionContext.setTransform(1,0,0,1,0,0);
        state.compositionContext.clearRect(0,0,width,height);
        state.compositionContext.drawImage(state.api.canvas,0,0);
    }

    function applyRecipeComposition(state, now) {
        var recipe = state.def.recipeIndex;
        if (recipe === 0) return;
        ensureCompositionBuffer(state);
        var ctx = state.ctx, source = state.compositionBuffer, w = state.api.size.width, ht = state.api.size.height;
        ctx.save();
        if (recipe === 1) {
            ctx.clearRect(0,0,w,ht);
            ctx.globalAlpha = .38;
            ctx.drawImage(source,0,0,w,ht);
            ctx.globalAlpha = 1;
            var sources = state.pulses.slice(-3);
            while (sources.length < 3) sources.push({x:.22+sources.length*.28,y:.5+Math.sin(sources.length*2.1)*.18});
            sources.forEach(function (pulse,index) {
                var radius = Math.min(w,ht) * (.16 + index*.025);
                ctx.save();
                ctx.beginPath(); ctx.arc(pulse.x*w,pulse.y*ht,radius,0,TAU); ctx.clip();
                ctx.globalCompositeOperation = "screen";
                ctx.globalAlpha = .72;
                var scale = 1.08 + index*.055;
                ctx.translate(pulse.x*w,pulse.y*ht); ctx.scale(scale,scale); ctx.translate(-pulse.x*w,-pulse.y*ht);
                ctx.drawImage(source,0,0,w,ht);
                ctx.restore();
                ctx.strokeStyle = index%2 ? rgba(state.secondary,.68) : rgba(state.accent,.68);
                ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(pulse.x*w,pulse.y*ht,radius,0,TAU); ctx.stroke();
            });
        } else if (recipe === 2) {
            ctx.save();
            ctx.globalCompositeOperation = "destination-out";
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 18; ctx.lineCap = "round"; ctx.lineJoin = "round";
            state.strokes.forEach(function (stroke) { if (stroke.length<2)return;ctx.beginPath();stroke.forEach(function(p,i){if(!i)ctx.moveTo(p.x*w,p.y*ht);else ctx.lineTo(p.x*w,p.y*ht);});ctx.stroke(); });
            ctx.restore();
            ctx.strokeStyle = rgba(state.secondary,.82); ctx.lineWidth = 2;
            state.strokes.forEach(function (stroke) { if (stroke.length<2)return;ctx.beginPath();stroke.forEach(function(p,i){if(!i)ctx.moveTo(p.x*w,p.y*ht);else ctx.lineTo(p.x*w,p.y*ht);});ctx.stroke(); });
        } else if (recipe === 3) {
            ctx.clearRect(0,0,w,ht);
            var bands = 4;
            for (var band=0;band<bands;band++) {
                var top = band/bands*ht, bandHeight = ht/bands;
                ctx.save(); ctx.beginPath(); ctx.rect(0,top,w,bandHeight-2); ctx.clip();
                var direction = band%2 ? -1 : 1;
                var offset = direction * (state.scroll-.5) * w * (.12+band*.035);
                var zoom = 1 + Math.abs(state.scroll-.5) * (.06+band*.02);
                ctx.translate(w*.5+offset,top+bandHeight*.5); ctx.scale(zoom,zoom); ctx.translate(-w*.5,-top-bandHeight*.5);
                ctx.drawImage(source,0,0,w,ht); ctx.restore();
            }
            ctx.strokeStyle = rgba(state.accent,.28); ctx.lineWidth=1;
            for(var line=1;line<bands;line++){ctx.beginPath();ctx.moveTo(0,line/bands*ht);ctx.lineTo(w,line/bands*ht);ctx.stroke();}
        } else {
            ctx.clearRect(0,0,w,ht);
            var gap = Math.max(7,w*.008), panelWidth=(w-gap*4)/3;
            for(var panel=0;panel<3;panel++){
                var left=gap+panel*(panelWidth+gap),phase=Math.sin(now*.0007+panel*2.1)*.045;
                ctx.save();ctx.beginPath();ctx.roundRect(left,gap,panelWidth,ht-gap*2,Math.min(18,panelWidth*.08));ctx.clip();
                ctx.translate(left+panelWidth*.5,ht*.5);ctx.rotate(phase);ctx.scale(1.1+panel*.07,1.1+panel*.07);ctx.translate(-w*.5,-ht*.5);
                ctx.drawImage(source,0,0,w,ht);ctx.restore();
                ctx.strokeStyle=panel===state.preset%3?state.secondary:rgba(state.accent,.35);ctx.lineWidth=panel===state.preset%3?2:1;ctx.beginPath();ctx.roundRect(left,gap,panelWidth,ht-gap*2,Math.min(18,panelWidth*.08));ctx.stroke();
            }
        }
        ctx.restore();
    }

    var drawers = {
        "oscillatory-fields": drawOscillatory,
        "deformable-matter": drawDeformable,
        "articulated-solvers": drawArticulated,
        "granular-systems": drawGranular,
        "swarm-intelligence": drawSwarm,
        "dynamic-networks": drawNetworks,
        "morphogenetic-growth": drawGrowth,
        "cellular-automata": drawCellular,
        "path-planning": drawPathPlanning,
        "computational-geometry": drawComputationalGeometry,
        "curve-construction": drawCurves,
        "fractal-navigation": drawFractal,
        "chaotic-dynamics": drawChaos,
        "optical-fields": drawOptics,
        "image-reconstruction": drawImageReconstruction,
        "temporal-compositing": drawTemporal,
        "spatial-3d": drawSpatial3D,
        "gesture-pen": drawGesturePen,
        "target-acquisition": drawTargetAcquisition,
        "navigation-focus": drawNavigation,
        "micro-state": drawMicro,
        "temporal-scrubbing": drawScrubbing,
        "data-layout": drawDataLayout,
        "computational-type": drawTypography,
        "audio-spatial": drawAudio
    };

    function generatedEffect(api) {
        var definition = Data.byId[Number(api.body.dataset.effectId)];
        if (!definition) return {};
        var state = createState(api, definition);
        var drawer = drawers[definition.familyId];
        api.setState(definition.algorithmKey.toUpperCase().replaceAll("-", " ") + " / LIVE");
        api.setPrompt(definition.instructionZh);
        api.setAction(definition.recipeIndex === 4 ? "NEXT SIGNAL" : "CHANGE PRESET");

        function toggleAudio() {
            if (definition.familyId !== "audio-spatial") return commonAction(state);
            if (!state.audioContext) {
                state.audioContext = new AudioContext();
                state.analyser = state.audioContext.createAnalyser();
                state.analyser.fftSize = 256;
                state.audioData = new Uint8Array(state.analyser.frequencyBinCount);
                state.gain = state.audioContext.createGain();
                state.gain.gain.value = 0.025;
                state.analyser.connect(state.gain).connect(state.audioContext.destination);
                [110, 164.81, 220].forEach(function (frequency, index) {
                    var oscillator = state.audioContext.createOscillator();
                    oscillator.type = index === 1 ? "triangle" : "sine";
                    oscillator.frequency.value = frequency;
                    var gain = state.audioContext.createGain(); gain.gain.value = 0.38;
                    oscillator.connect(gain).connect(state.analyser); oscillator.start();
                });
                state.audioRunning = true;
            } else if (state.audioRunning) { state.audioContext.suspend(); state.audioRunning = false; }
            else { state.audioContext.resume(); state.audioRunning = true; }
            api.setState(state.audioRunning ? "AUDIO / LIVE" : "AUDIO / PAUSED");
            api.setAction(state.audioRunning ? "PAUSE AUDIO" : "START AUDIO");
        }

        if (definition.familyId === "audio-spatial") {
            document.addEventListener("visibilitychange", function () { if (document.hidden && state.audioContext && state.audioRunning) { state.audioContext.suspend(); state.audioRunning = false; } });
        }

        return {
            pointer: function (type, point) { commonPointer(state, type, point); },
            wheel: function (delta) { state.scroll = h.clamp(state.scroll - delta * 0.0009, 0, 1); return definition.recipeIndex !== 3; },
            scroll: function (progress, velocity) { state.scroll = progress; state.velocity = velocity; },
            keydown: function (event) {
                if (event.key === " " || event.key === "Enter") { event.preventDefault(); definition.familyId === "audio-spatial" ? toggleAudio() : commonAction(state); }
                if (event.key === "ArrowLeft") state.pointer.x = h.clamp(state.pointer.x - .04, 0, 1);
                if (event.key === "ArrowRight") state.pointer.x = h.clamp(state.pointer.x + .04, 0, 1);
                if (event.key === "ArrowUp") state.pointer.y = h.clamp(state.pointer.y - .04, 0, 1);
                if (event.key === "ArrowDown") state.pointer.y = h.clamp(state.pointer.y + .04, 0, 1);
            },
            action: definition.familyId === "audio-spatial" ? toggleAudio : function () { commonAction(state); },
            resize: function () { state.buffer = null; state.compositionBuffer = null; state.cells = null; state.dirty = true; },
            frame: function (now, delta, reduced) {
                syntheticInput(state, now);
                if (state.analyser && state.audioRunning) state.analyser.getByteFrequencyData(state.audioData);
                drawer(state, now, reduced ? 0 : delta);
                applyRecipeComposition(state, now);
                state.frameCount += 1;
            }
        };
    }

    Motion.register({ "generated-effect": generatedEffect });
}());
