(function () {
  const header = document.querySelector("[data-header]");
  const canvas = document.getElementById("protocol-map");

  if (header) {
    const onScroll = () => {
      header.toggleAttribute("data-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  if (!canvas) {
    return;
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const context = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let animationFrame = 0;
  let start = performance.now();

  const nodes = [
    { id: "buyer", label: "Buyer agent", x: 0.54, y: 0.28, color: "#23684d" },
    { id: "terms", label: "Agreement", x: 0.72, y: 0.24, color: "#275f92" },
    { id: "work", label: "Work", x: 0.84, y: 0.44, color: "#65517f" },
    { id: "verify", label: "Verifier", x: 0.70, y: 0.60, color: "#9b5f08" },
    { id: "settle", label: "Rail adapter", x: 0.52, y: 0.62, color: "#23684d" },
    { id: "receipt", label: "Receipts", x: 0.62, y: 0.79, color: "#9e3f3d" }
  ];

  const edges = [
    ["buyer", "terms"],
    ["terms", "work"],
    ["work", "verify"],
    ["verify", "settle"],
    ["settle", "receipt"],
    ["receipt", "buyer"],
    ["terms", "settle"]
  ];

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(320, rect.width);
    height = Math.max(420, rect.height);
    canvas.width = Math.floor(width * scale);
    canvas.height = Math.floor(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    draw(performance.now());
  }

  function point(node) {
    return {
      x: node.x * width,
      y: node.y * height
    };
  }

  function findNode(id) {
    return nodes.find((node) => node.id === id);
  }

  function drawNode(node) {
    const p = point(node);
    const radius = Math.max(42, Math.min(width, height) * 0.065);

    context.beginPath();
    context.arc(p.x, p.y, radius, 0, Math.PI * 2);
    context.fillStyle = "#fffdf8";
    context.fill();
    context.lineWidth = 1.5;
    context.strokeStyle = node.color;
    context.stroke();

    context.beginPath();
    context.arc(p.x, p.y - radius * 0.45, 5, 0, Math.PI * 2);
    context.fillStyle = node.color;
    context.fill();

    context.fillStyle = "#171a17";
    context.font = "700 13px ui-sans-serif, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(node.label, p.x, p.y + 7, radius * 1.45);
  }

  function drawEdge(source, target, progress) {
    const a = point(source);
    const b = point(target);
    const midY = (a.y + b.y) / 2;

    context.beginPath();
    context.moveTo(a.x, a.y);
    context.bezierCurveTo(a.x, midY, b.x, midY, b.x, b.y);
    context.lineWidth = 1.4;
    context.strokeStyle = "rgba(18, 21, 18, 0.20)";
    context.stroke();

    const pulse = cubicPoint(a, { x: a.x, y: midY }, { x: b.x, y: midY }, b, progress);
    context.beginPath();
    context.arc(pulse.x, pulse.y, 4.6, 0, Math.PI * 2);
    context.fillStyle = target.color;
    context.fill();
  }

  function cubicPoint(a, b, c, d, t) {
    const mt = 1 - t;
    return {
      x: mt * mt * mt * a.x + 3 * mt * mt * t * b.x + 3 * mt * t * t * c.x + t * t * t * d.x,
      y: mt * mt * mt * a.y + 3 * mt * mt * t * b.y + 3 * mt * t * t * c.y + t * t * t * d.y
    };
  }

  function draw(now) {
    context.clearRect(0, 0, width, height);

    context.fillStyle = "#f7f4ec";
    context.fillRect(0, 0, width, height);

    context.save();
    context.globalAlpha = 0.62;
    context.strokeStyle = "rgba(35, 104, 77, 0.11)";
    context.lineWidth = 1;
    const grid = Math.max(52, Math.min(width, height) / 8);
    for (let x = width * 0.36; x < width; x += grid) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 0; y < height; y += grid) {
      context.beginPath();
      context.moveTo(width * 0.32, y);
      context.lineTo(width, y);
      context.stroke();
    }
    context.restore();

    const elapsed = (now - start) / 1700;
    edges.forEach(([from, to], index) => {
      const progress = prefersReducedMotion.matches ? 0.72 : (elapsed + index / edges.length) % 1;
      drawEdge(findNode(from), findNode(to), progress);
    });

    nodes.forEach(drawNode);

    if (!prefersReducedMotion.matches) {
      animationFrame = window.requestAnimationFrame(draw);
    }
  }

  window.addEventListener("resize", resize, { passive: true });
  resize();

  if (!prefersReducedMotion.matches) {
    animationFrame = window.requestAnimationFrame(draw);
  }

  prefersReducedMotion.addEventListener("change", () => {
    window.cancelAnimationFrame(animationFrame);
    start = performance.now();
    resize();
    if (!prefersReducedMotion.matches) {
      animationFrame = window.requestAnimationFrame(draw);
    }
  });
})();
