(function () {
    "use strict";

    var stage = document.querySelector("[data-fluid-stage]");
    var canvas = document.getElementById("fluid-canvas");
    var pointerCopy = document.querySelector("[data-pointer-copy]");
    var liveState = document.querySelector(".live-state");
    var renderState = document.querySelector(".telemetry dl div:last-child dd");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!stage || !canvas) return;

    if (reduceMotion) {
        stage.classList.add("fluid-static");
        if (pointerCopy) pointerCopy.textContent = "已按系统偏好暂停流体动画";
        if (liveState) liveState.textContent = "PAUSED";
        if (renderState) renderState.textContent = "静态画面";
        return;
    }

    var gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        powerPreference: "high-performance"
    });

    if (!gl) {
        stage.classList.add("fluid-static");
        if (pointerCopy) pointerCopy.textContent = "当前浏览器显示静态水面";
        if (liveState) liveState.textContent = "STATIC";
        if (renderState) renderState.textContent = "静态画面";
        return;
    }

    var vertexSource = [
        "attribute vec2 a_position;",
        "varying vec2 v_uv;",
        "void main() {",
        "  v_uv = a_position * 0.5 + 0.5;",
        "  gl_Position = vec4(a_position, 0.0, 1.0);",
        "}"
    ].join("\n");

    var fragmentSource = [
        "precision mediump float;",
        "varying vec2 v_uv;",
        "uniform sampler2D u_texture;",
        "uniform vec2 u_resolution;",
        "uniform vec2 u_imageResolution;",
        "uniform vec2 u_pointer;",
        "uniform vec2 u_velocity;",
        "uniform float u_energy;",
        "uniform float u_time;",
        "float hash(vec2 p) {",
        "  p = fract(p * vec2(123.34, 456.21));",
        "  p += dot(p, p + 45.32);",
        "  return fract(p.x * p.y);",
        "}",
        "float noise(vec2 p) {",
        "  vec2 i = floor(p);",
        "  vec2 f = fract(p);",
        "  f = f * f * (3.0 - 2.0 * f);",
        "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),",
        "             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);",
        "}",
        "vec2 coverUv(vec2 uv) {",
        "  float screenAspect = u_resolution.x / u_resolution.y;",
        "  float imageAspect = u_imageResolution.x / u_imageResolution.y;",
        "  if (screenAspect > imageAspect) {",
        "    float visibleHeight = imageAspect / screenAspect;",
        "    uv.y = uv.y * visibleHeight + (1.0 - visibleHeight) * 0.5;",
        "  } else {",
        "    float visibleWidth = screenAspect / imageAspect;",
        "    uv.x = uv.x * visibleWidth + (1.0 - visibleWidth) * 0.5;",
        "  }",
        "  return uv;",
        "}",
        "void main() {",
        "  vec2 uv = v_uv;",
        "  float aspect = u_resolution.x / u_resolution.y;",
        "  float t = u_time * 0.075;",
        "  vec2 field = vec2(",
        "    noise(uv * 3.2 + vec2(t, -t * 0.7)),",
        "    noise(uv * 4.1 + vec2(-t * 0.8, t))",
        "  ) - 0.5;",
        "  field += 0.5 * (vec2(",
        "    noise(uv.yx * 7.0 + vec2(-t, t * 0.5)),",
        "    noise(uv.xy * 6.2 + vec2(t * 0.6, -t))",
        "  ) - 0.5);",
        "  uv += field * 0.018;",
        "  vec2 delta = uv - u_pointer;",
        "  delta.x *= aspect;",
        "  float falloff = exp(-dot(delta, delta) * 14.0);",
        "  vec2 tangent = vec2(-delta.y / aspect, delta.x);",
        "  vec2 physicalVelocity = vec2(u_velocity.x * aspect, u_velocity.y);",
        "  float speed = clamp(length(physicalVelocity) * 24.0, 0.0, 1.0);",
        "  uv += tangent * falloff * (0.035 + speed * 0.105) * u_energy;",
        "  uv -= u_velocity * falloff * (0.32 + speed * 0.65) * u_energy;",
        "  vec2 chromaPhysical = normalize(physicalVelocity + vec2(0.00001)) * falloff * speed * 0.007;",
        "  vec2 chroma = vec2(chromaPhysical.x / aspect, chromaPhysical.y);",
        "  vec2 sampleUv = coverUv(clamp(uv, 0.001, 0.999));",
        "  vec2 redUv = coverUv(clamp(uv + chroma, 0.001, 0.999));",
        "  vec2 blueUv = coverUv(clamp(uv - chroma, 0.001, 0.999));",
        "  vec3 color = texture2D(u_texture, sampleUv).rgb;",
        "  color.r = texture2D(u_texture, redUv).r;",
        "  color.b = texture2D(u_texture, blueUv).b;",
        "  float highlight = falloff * (0.045 + speed * 0.09) * u_energy;",
        "  color += vec3(0.26, 0.68, 1.0) * highlight;",
        "  float vignette = 1.0 - smoothstep(0.24, 0.92, distance(v_uv, vec2(0.5)));",
        "  color *= 0.72 + vignette * 0.34;",
        "  gl_FragColor = vec4(color, 1.0);",
        "}"
    ].join("\n");

    function compileShader(type, source) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    var program = gl.createProgram();
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
    }
    gl.useProgram(program);

    var vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    var positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    var uniforms = {
        texture: gl.getUniformLocation(program, "u_texture"),
        resolution: gl.getUniformLocation(program, "u_resolution"),
        imageResolution: gl.getUniformLocation(program, "u_imageResolution"),
        pointer: gl.getUniformLocation(program, "u_pointer"),
        velocity: gl.getUniformLocation(program, "u_velocity"),
        energy: gl.getUniformLocation(program, "u_energy"),
        time: gl.getUniformLocation(program, "u_time")
    };

    var pointer = {
        targetX: 0.62,
        targetY: 0.42,
        x: 0.62,
        y: 0.42,
        velocityX: 0,
        velocityY: 0,
        targetVelocityX: 0,
        targetVelocityY: 0,
        energy: 0.22
    };
    var textureReady = false;
    var imageWidth = 1;
    var imageHeight = 1;
    var hasPointerPosition = false;
    var lastPointerTime = 0;
    var stageVisible = true;
    var animationFrame = 0;

    function resize() {
        var cssWidth = Math.max(1, canvas.clientWidth);
        var cssHeight = Math.max(1, canvas.clientHeight);
        var dpr = Math.min(
            window.devicePixelRatio || 1,
            window.innerWidth < 760 ? 1.25 : 1.5,
            1280 / cssWidth,
            720 / cssHeight
        );
        var width = Math.max(1, Math.round(cssWidth * dpr));
        var height = Math.max(1, Math.round(cssHeight * dpr));
        if (canvas.width === width && canvas.height === height) return;
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
    }

    function updatePointer(event) {
        var rect = stage.getBoundingClientRect();
        var nextX = (event.clientX - rect.left) / rect.width;
        var nextY = 1 - (event.clientY - rect.top) / rect.height;
        var isFirstPointer = !hasPointerPosition;

        if (isFirstPointer) {
            pointer.x = nextX;
            pointer.y = nextY;
            pointer.targetX = nextX;
            pointer.targetY = nextY;
            pointer.velocityX = 0;
            pointer.velocityY = 0;
            pointer.targetVelocityX = 0;
            pointer.targetVelocityY = 0;
            hasPointerPosition = true;
        } else {
            var elapsed = Math.max(8, Math.min(48, event.timeStamp - lastPointerTime));
            var frameScale = 16.667 / elapsed;
            pointer.targetVelocityX = (nextX - pointer.targetX) * frameScale;
            pointer.targetVelocityY = (nextY - pointer.targetY) * frameScale;
            pointer.targetX = nextX;
            pointer.targetY = nextY;
        }

        lastPointerTime = event.timeStamp;
        pointer.energy = isFirstPointer ? 0.75 : 1;
        if (pointerCopy) pointerCopy.textContent = "流场已捕捉你的轨迹";
    }

    stage.addEventListener("pointermove", updatePointer, { passive: true });
    stage.addEventListener("pointerdown", updatePointer, { passive: true });
    stage.addEventListener("pointerleave", function () {
        hasPointerPosition = false;
        pointer.targetVelocityX = 0;
        pointer.targetVelocityY = 0;
        if (pointerCopy) pointerCopy.textContent = "移动指针，搅动水面";
    });

    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    var image = new Image();
    image.addEventListener("load", function () {
        imageWidth = image.naturalWidth;
        imageHeight = image.naturalHeight;
        var uploadSource = image;
        var maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

        if (imageWidth > maxTextureSize || imageHeight > maxTextureSize) {
            var textureScale = maxTextureSize / Math.max(imageWidth, imageHeight);
            var resizedTexture = document.createElement("canvas");
            resizedTexture.width = Math.max(1, Math.floor(imageWidth * textureScale));
            resizedTexture.height = Math.max(1, Math.floor(imageHeight * textureScale));
            resizedTexture.getContext("2d").drawImage(image, 0, 0, resizedTexture.width, resizedTexture.height);
            imageWidth = resizedTexture.width;
            imageHeight = resizedTexture.height;
            uploadSource = resizedTexture;
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, uploadSource);
        if (gl.getError() !== gl.NO_ERROR) {
            throw new Error("Fluid texture upload failed");
        }
        textureReady = true;
        stage.classList.add("fluid-ready");
    });
    image.src = stage.getAttribute("data-fluid-image") || "../assets/bg11-720.webp";

    function render(time) {
        animationFrame = 0;
        if (!stageVisible || document.hidden) return;

        resize();
        pointer.x += (pointer.targetX - pointer.x) * 0.11;
        pointer.y += (pointer.targetY - pointer.y) * 0.11;
        pointer.velocityX += (pointer.targetVelocityX - pointer.velocityX) * 0.18;
        pointer.velocityY += (pointer.targetVelocityY - pointer.velocityY) * 0.18;
        pointer.targetVelocityX *= 0.86;
        pointer.targetVelocityY *= 0.86;
        pointer.energy = Math.max(0.16, pointer.energy * 0.972);

        if (textureReady) {
            gl.uniform1i(uniforms.texture, 0);
            gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
            gl.uniform2f(uniforms.imageResolution, imageWidth, imageHeight);
            gl.uniform2f(uniforms.pointer, pointer.x, pointer.y);
            gl.uniform2f(uniforms.velocity, pointer.velocityX, pointer.velocityY);
            gl.uniform1f(uniforms.energy, pointer.energy);
            gl.uniform1f(uniforms.time, time * 0.001);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }

        startRender();
    }

    function startRender() {
        if (animationFrame || !stageVisible || document.hidden) return;
        animationFrame = window.requestAnimationFrame(render);
    }

    var stageObserver = new IntersectionObserver(function (entries) {
        stageVisible = entries[0].isIntersecting;
        startRender();
    }, { threshold: 0.01 });

    stageObserver.observe(stage);
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", startRender);
    startRender();
}());

(function () {
    "use strict";

    var expandTrack = document.querySelector("[data-expand-track]");
    var expandPlane = document.querySelector("[data-expand-plane]");
    var expandCopy = document.querySelector("[data-expand-copy]");
    var expandPercent = document.querySelector("[data-expand-percent]");
    var expandSticky = expandTrack && expandTrack.querySelector(".expansion-sticky");
    var sceneTrack = document.querySelector("[data-scene-track]");
    var sceneSticky = sceneTrack && sceneTrack.querySelector(".scene-sticky");
    var scenes = Array.prototype.slice.call(document.querySelectorAll("[data-scene]"));
    var sceneDots = Array.prototype.slice.call(document.querySelectorAll("[data-scene-dot]"));
    var sceneNumber = document.querySelector("[data-scene-number]");
    var nav = document.querySelector(".motion-nav");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var ticking = false;

    if ((!expandTrack && !sceneTrack) || reduceMotion) return;

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function smoothstep(edge0, edge1, value) {
        var x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
        return x * x * (3 - 2 * x);
    }

    function trackProgress(element, stickyElement) {
        var rect = element.getBoundingClientRect();
        var stickyHeight = stickyElement ? stickyElement.getBoundingClientRect().height : window.innerHeight;
        var distance = Math.max(1, element.offsetHeight - stickyHeight);
        return clamp(-rect.top / distance, 0, 1);
    }

    function updateExpansion() {
        if (!expandTrack || !expandPlane) return;
        var progress = trackProgress(expandTrack, expandSticky);
        var eased = smoothstep(0, 1, progress);
        var maxClipX = Math.min(170, Math.max(24, window.innerWidth * 0.11));
        var maxClipY = Math.min(140, Math.max(88, window.innerHeight * 0.14));
        var radius = window.innerWidth < 760 ? 24 : 34;

        expandPlane.style.setProperty("--clip-x", ((1 - eased) * maxClipX).toFixed(2) + "px");
        expandPlane.style.setProperty("--clip-y", ((1 - eased) * maxClipY).toFixed(2) + "px");
        expandPlane.style.setProperty("--clip-radius", ((1 - eased) * radius).toFixed(2) + "px");
        expandPlane.style.setProperty("--image-scale", (1.08 - eased * 0.08).toFixed(4));
        expandPlane.style.setProperty("--expand-progress", eased.toFixed(4));

        if (expandCopy) {
            var copyFade = 1 - smoothstep(0.5, 0.9, progress);
            expandCopy.style.opacity = copyFade.toFixed(4);
            expandCopy.style.transform = "translate3d(0," + (-progress * 34).toFixed(2) + "px,0)";
        }

        if (expandPercent) {
            expandPercent.textContent = String(Math.round(eased * 100)).padStart(3, "0") + "%";
        }
    }

    function updateScenes() {
        if (!sceneTrack || !scenes.length) return;
        var progress = trackProgress(sceneTrack, sceneSticky);
        var position = progress * (scenes.length - 1);
        var activeIndex = Math.round(position);

        scenes.forEach(function (scene, index) {
            var weight = clamp(1 - Math.abs(position - index), 0, 1);
            var copy = scene.querySelector(".scene-copy");
            scene.style.opacity = weight.toFixed(4);
            scene.style.visibility = weight > 0.002 ? "visible" : "hidden";
            scene.style.setProperty("--scene-scale", (1.055 - weight * 0.055).toFixed(4));
            scene.classList.toggle("scene-active", index === activeIndex);
            if (copy) copy.style.setProperty("--copy-y", ((index - position) * 38).toFixed(2) + "px");
        });

        sceneDots.forEach(function (dot, index) {
            dot.classList.toggle("dot-active", index === activeIndex);
        });

        if (sceneNumber) {
            sceneNumber.textContent = String(activeIndex + 1).padStart(2, "0");
        }
    }

    function updateNavigation() {
        if (nav) {
            var scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
            nav.style.setProperty("--page-progress", clamp(window.scrollY / scrollRange, 0, 1).toFixed(4));
        }
    }

    function update() {
        ticking = false;
        updateExpansion();
        updateScenes();
        updateNavigation();
    }

    function requestUpdate() {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
    requestUpdate();
}());
